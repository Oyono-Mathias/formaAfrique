
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/context/RoleContext';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  serverTimestamp,
  doc,
  setDoc,
} from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PlusCircle, MessageSquare, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';

interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  instructorId: string;
  progress: number;
}

interface StudentData {
  id: string; // Unique enrollment ID
  studentId: string;
  name: string;
  email: string;
  course: string;
  progress: number;
  isOnline: boolean;
  lastSeen: Date;
  avatar?: string;
  initials: string;
}

export default function MyStudentsPage() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { formaAfriqueUser: instructor, isUserLoading: isInstructorLoading, user } = useRole();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const db = getFirestore();
  const router = useRouter();

  // State to force re-render for time updates
  const [time, setTime] = useState(Date.now());

  useEffect(() => {
    // This interval will trigger a re-render every 60 seconds
    // to update the 'formatDistanceToNow' output.
    const timer = setInterval(() => {
      setTime(Date.now());
    }, 60000); // 60 seconds

    return () => clearInterval(timer); // Cleanup on unmount
  }, []);

  useEffect(() => {
    if (!instructor?.uid) {
      if (!isInstructorLoading) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const enrollmentsQuery = query(
      collection(db, 'enrollments'),
      where('instructorId', '==', instructor.uid)
    );

    const unsubscribe = onSnapshot(enrollmentsQuery, async (snapshot) => {
      if (snapshot.empty) {
        setStudents([]);
        setIsLoading(false);
        return;
      }

      const enrollmentData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Enrollment[];

      const studentIds = [...new Set(enrollmentData.map(e => e.studentId))];
      const courseIds = [...new Set(enrollmentData.map(e => e.courseId))];

      const userDocs = studentIds.length > 0 ? await getDocs(query(collection(db, 'users'), where('uid', 'in', studentIds.slice(0,30)))) : { docs: [] };
      const courseDocs = courseIds.length > 0 ? await getDocs(query(collection(db, 'courses'), where('__name__', 'in', courseIds.slice(0,30)))) : { docs: [] };
      
      const usersMap = new Map(userDocs.docs.map(d => [d.data().uid, d.data()]));
      const coursesMap = new Map(courseDocs.docs.map(d => [d.id, d.data()]));

      const studentsList: StudentData[] = enrollmentData.map(enrollment => {
        const studentInfo = usersMap.get(enrollment.studentId);
        const courseInfo = coursesMap.get(enrollment.courseId);
        const name = studentInfo?.fullName || 'Utilisateur inconnu';
        
        return {
          id: enrollment.id, // Use unique enrollment ID for the key
          studentId: enrollment.studentId,
          name: name,
          email: studentInfo?.email || 'email inconnu',
          course: courseInfo?.title || 'Cours inconnu',
          progress: enrollment.progress || 0,
          isOnline: studentInfo?.isOnline || false,
          lastSeen: studentInfo?.lastSeen?.toDate() || new Date(),
          avatar: studentInfo?.profilePictureURL,
          initials: name.split(' ').map((n:string) => n[0]).join(''),
        };
      });

      setStudents(studentsList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching students: ", error);
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible de charger les étudiants." });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [instructor, db, isInstructorLoading, toast]);

  const handleStartChat = async (studentId: string) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Vous devez être connecté.' });
        return;
    }
    const instructorId = user.uid;
    const chatsRef = collection(db, 'chats');

    // Query to find if a chat already exists
    const q = query(chatsRef, where('participants', 'array-contains', instructorId));
    
    const querySnapshot = await getDocs(q);
    let existingChatId: string | null = null;
    
    querySnapshot.forEach(doc => {
        if (doc.data().participants.includes(studentId)) {
            existingChatId = doc.id;
        }
    });
    
    let chatIdToRedirect: string | null = existingChatId;

    if (!existingChatId) {
        // Create a new chat if one doesn't exist
        const newChatRef = doc(collection(db, 'chats'));
        const sortedParticipants = [instructorId, studentId].sort();
        await setDoc(newChatRef, {
            participants: sortedParticipants,
            updatedAt: serverTimestamp(),
            lastMessage: 'Conversation commencée',
        });
        chatIdToRedirect = newChatRef.id;
    }
    
    // Redirect to the new unified messages page, which will open the correct chat
    router.push(`/messages/${chatIdToRedirect}`);
  };

  const handleSave = () => {
    toast({
      title: "Succès !",
      description: "L'étudiant a été ajouté.",
    });
    setOpen(false);
  };

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const lowercasedFilter = searchTerm.toLowerCase();
    return students.filter(student =>
      student.name.toLowerCase().includes(lowercasedFilter) ||
      student.email.toLowerCase().includes(lowercasedFilter)
    );
  }, [students, searchTerm]);
  
  const renderSkeleton = () => (
    [...Array(3)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-10 w-48" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-8 w-8 inline-block" /></TableCell>
      </TableRow>
    ))
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold">Mes Étudiants</h1>
            <p className="text-muted-foreground">
              Gérez et suivez les progrès de vos étudiants.
            </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter un étudiant
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Ajouter un nouvel étudiant</DialogTitle>
              <DialogDescription>
                Remplissez les informations ci-dessous pour inscrire un nouvel étudiant à une de vos formations.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Nom complet
                </Label>
                <Input id="name" placeholder="Amina Diallo" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input id="email" type="email" placeholder="amina@example.com" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="course" className="text-right">
                  Formation
                </Label>
                <Input id="course" placeholder="Développement Web Avancé" className="col-span-3" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSave}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Rechercher un étudiant par nom ou email..."
          className="pl-9 w-full md:w-1/3 bg-white text-black border-slate-200 focus:border-primary placeholder:text-slate-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-muted/50">
              <TableHead className="w-[250px]">Nom de l'étudiant</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Formation suivie</TableHead>
              <TableHead className="w-[150px]">Progrès (%)</TableHead>
              <TableHead>Activité</TableHead>
              <TableHead className="text-right">Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? renderSkeleton() : (
              filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <TableRow key={student.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={student.avatar} alt={student.name} />
                          <AvatarFallback>{student.initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{student.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{student.course}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={student.progress} className="h-2" />
                        <span>{student.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.isOnline ? (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                          En ligne
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                           {student.lastSeen && `Il y a ${formatDistanceToNow(student.lastSeen, { locale: fr })}`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleStartChat(student.studentId)}>
                        <MessageSquare className="h-4 w-4" />
                        <span className="sr-only">Contacter l'étudiant</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    {searchTerm ? "Aucun étudiant ne correspond à votre recherche." : "Aucun étudiant trouvé."}
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
