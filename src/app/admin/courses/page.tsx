
'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCollection, useMemoFirebase } from '@/firebase';
import {
  getFirestore,
  collection,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  Query,
} from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
  BookOpen,
  Filter,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { Course } from '@/lib/types';
import type { FormaAfriqueUser } from '@/context/RoleContext';
import { cn } from '@/lib/utils';


const FILTERS = ['Tous', 'Published', 'Pending Review', 'Draft'] as const;
type CourseStatusFilter = typeof FILTERS[number];

const getStatusBadgeVariant = (status: Course['status']) => {
  switch (status) {
    case 'Published':
      return 'default';
    case 'Pending Review':
      return 'secondary';
    case 'Draft':
      return 'outline';
    default:
      return 'secondary';
  }
};

const getStatusBadgeText = (status: Course['status']) => {
    switch (status) {
        case 'Published': return 'Publié';
        case 'Pending Review': return 'En révision';
        case 'Draft': return 'Brouillon';
        default: return status;
    }
}

const CourseCard = ({
  course,
  instructor,
  onStatusChange,
  onDelete,
}: {
  course: Course;
  instructor: FormaAfriqueUser | null;
  onStatusChange: (id: string, status: Course['status']) => void;
  onDelete: (id: string) => void;
}) => {
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  return (
    <>
      <Card className="overflow-hidden transition-shadow duration-300 hover:shadow-xl rounded-xl border-slate-200 bg-white flex flex-col">
        <div className="relative">
          <Image
            src={course.imageUrl || `https://picsum.photos/seed/${course.id}/600/338`}
            alt={course.title}
            width={600}
            height={338}
            className="aspect-video object-cover w-full"
          />
           <Badge
            variant={getStatusBadgeVariant(course.status)}
            className={cn(
              "absolute top-2 right-2 text-xs",
              course.status === 'Published' && "bg-green-100 text-green-800 border-green-200",
              course.status === 'Pending Review' && "bg-blue-100 text-blue-800 border-blue-200",
            )}
          >
            {getStatusBadgeText(course.status)}
          </Badge>
        </div>
        <CardContent className="p-3 flex flex-col flex-grow">
          <h3 className="font-bold text-sm truncate text-slate-900 mb-1 h-5">{course.title}</h3>
          <p className="text-xs text-slate-500 mb-2">Par {instructor?.fullName || '...'}</p>
          <div className="flex-grow"></div>
          <div className="flex items-center justify-between mt-1">
            <p className="font-semibold text-base text-slate-900">
              {course.price > 0 ? `${course.price.toLocaleString('fr-FR')} XOF` : 'Gratuit'}
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                    <Link href={`/course/${course.id}`}><Eye className="mr-2 h-4 w-4"/>Voir la page</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href={`/instructor/courses/edit/${course.id}`}><Edit className="mr-2 h-4 w-4"/>Modifier</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Edit className="mr-2 h-4 w-4" />
                        <span>Changer le statut</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => onStatusChange(course.id, 'Published')}>Publié</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStatusChange(course.id, 'Pending Review')}>En révision</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStatusChange(course.id, 'Draft')}>Brouillon</DropdownMenuItem>
                    </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuItem className="text-red-600" onSelect={() => setIsAlertOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement le cours "{course.title}" ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(course.id)} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default function AdminCoursesPage() {
  const db = getFirestore();
  const { toast } = useToast();
  const [instructors, setInstructors] = useState<Map<string, FormaAfriqueUser>>(new Map());
  const [filter, setFilter] = useState<CourseStatusFilter>('Tous');

  const coursesQuery = useMemoFirebase(() => {
    let q: Query = query(collection(db, 'courses'));
    if (filter !== 'Tous') {
      q = query(q, where('status', '==', filter));
    }
    return q;
  }, [db, filter]);

  const { data: courses, isLoading: coursesLoading } = useCollection<Course>(coursesQuery);

  useEffect(() => {
    if (!courses) return;

    const fetchInstructors = async () => {
      const instructorIds = [...new Set(courses.map(course => course.instructorId))];
      const newInstructors = new Map(instructors);
      const idsToFetch = instructorIds.filter(id => !newInstructors.has(id));

      if (idsToFetch.length === 0) return;
      
      // Firestore 'in' query has a limit of 30. For more courses, batching would be needed.
      const usersQuery = query(collection(db, 'users'), where('uid', 'in', idsToFetch.slice(0, 30)));
      const snapshot = await getDocs(usersQuery);

      snapshot.forEach(doc => {
        newInstructors.set(doc.data().uid, doc.data() as FormaAfriqueUser);
      });
      setInstructors(newInstructors);
    };

    fetchInstructors();
  }, [courses, db, instructors]);

  const handleStatusChange = async (courseId: string, status: Course['status']) => {
    const courseRef = doc(db, 'courses', courseId);
    try {
      await updateDoc(courseRef, { status: status });
      toast({ title: 'Statut mis à jour', description: `Le cours est maintenant : ${getStatusBadgeText(status)}` });
    } catch (error) {
      console.error("Failed to update status:", error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de changer le statut.' });
    }
  };

  const handleDelete = async (courseId: string) => {
    const courseRef = doc(db, 'courses', courseId);
    try {
      await deleteDoc(courseRef);
      toast({ title: 'Cours supprimé', description: 'Le cours a été définitivement supprimé.' });
    } catch (error) {
      console.error("Failed to delete course:", error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer le cours.' });
    }
  };
  
  const isLoading = coursesLoading || (courses && courses.length > 0 && instructors.size === 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Gestion des Formations</h1>
        <p className="text-muted-foreground">Consultez, filtrez et gérez tous les cours de la plateforme.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {FILTERS.map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            className="rounded-full text-xs h-7"
            onClick={() => setFilter(f)}
          >
            {f === 'Tous' ? 'Tous' : getStatusBadgeText(f as Course['status'])}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-60 w-full rounded-xl" />)}
        </div>
      ) : courses && courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {courses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              instructor={instructors.get(course.instructorId) || null}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-xl">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-semibold">Aucun cours trouvé</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Aucun cours ne correspond au filtre '{filter}'.
          </p>
        </div>
      )}
    </div>
  );
}

    