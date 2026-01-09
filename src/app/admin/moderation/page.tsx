
'use client';

import { useState, useMemo } from 'react';
import { useRole } from '@/context/RoleContext';
import { useCollection, useMemoFirebase } from '@/firebase';
import { getFirestore, collection, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, UserCheck, ShieldX, Clock, BadgeCheck, FileText, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { FormaAfriqueUser } from '@/context/RoleContext';
import type { Course } from '@/lib/types';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { PdfViewerSkeleton } from '@/components/ui/PdfViewerClient';

const PdfViewerClient = dynamic(() => import('@/components/ui/PdfViewerClient').then(mod => mod.PdfViewerClient), { 
    ssr: false,
    loading: () => <PdfViewerSkeleton />
});


const InstructorRequestCard = ({ user, onApprove, onReject }: { user: FormaAfriqueUser & { instructorApplication?: any }, onApprove: (id: string) => void, onReject: (id: string) => void }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    
    const docUrl = user.instructorApplication?.verificationDocUrl;

    const handleApprove = async () => {
        setIsProcessing(true);
        await onApprove(user.uid);
        setIsProcessing(false);
    }
    
    const handleReject = async () => {
        setIsProcessing(true);
        await onReject(user.uid);
        setIsProcessing(false);
    }

    return (
        <>
            <Card className="flex flex-col dark:bg-[#1e293b] dark:border-slate-700">
                <CardHeader className="flex flex-row items-center gap-4">
                    <Avatar className="h-12 w-12">
                        <AvatarImage src={user.profilePictureURL} />
                        <AvatarFallback>{user.fullName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <CardTitle className="text-lg dark:text-white">{user.fullName}</CardTitle>
                        <CardDescription className="dark:text-slate-400">{user.email}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                    <p className="text-sm italic text-muted-foreground p-3 bg-slate-100 dark:bg-slate-800/50 rounded-md">
                        "{user.instructorApplication?.motivation || 'Aucune motivation fournie.'}"
                    </p>
                    {docUrl ? (
                         <Button variant="outline" size="sm" className="w-full dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 dark:border-slate-600" onClick={() => setIsViewerOpen(true)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Voir les justificatifs
                        </Button>
                    ) : (
                        <p className="text-xs text-center text-red-500">Aucun justificatif fourni.</p>
                    )}
                </CardContent>
                <CardFooter className="grid grid-cols-2 gap-2">
                    <Button onClick={handleReject} variant="destructive" disabled={isProcessing}>
                        <ShieldX className="mr-2 h-4 w-4" />
                        Refuser
                    </Button>
                    <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700" disabled={isProcessing}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Approuver
                    </Button>
                </CardFooter>
            </Card>

            <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
                <DialogContent className="max-w-4xl min-h-[80vh] flex flex-col dark:bg-[#1e293b] dark:border-slate-700">
                    <DialogHeader>
                        <DialogTitle className="dark:text-white">Justificatif pour {user.fullName}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 p-4 bg-muted dark:bg-slate-800 rounded-lg">
                        {docUrl && (docUrl.toLowerCase().includes('.pdf') ? (
                           <div className="h-full w-full">
                             <PdfViewerClient fileUrl={docUrl} />
                           </div>
                        ) : (
                            <Image src={docUrl} alt="Justificatif" layout="fill" objectFit="contain" />
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

const CourseReviewCard = ({ course }: { course: Course }) => {
     return (
        <Card className="dark:bg-[#1e293b] dark:border-slate-700">
            <CardHeader>
                <CardTitle className="text-base dark:text-white">{course.title}</CardTitle>
                <CardDescription className="dark:text-slate-400">Catégorie : {course.category || 'N/A'}</CardDescription>
            </CardHeader>
            <CardFooter>
                <Button asChild size="sm" variant="outline" className="dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 dark:border-slate-600">
                    <Link href={`/instructor/courses/edit/${course.id}`}>
                        Examiner le cours
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
};


export default function ModerationPage() {
    const { formaAfriqueUser: admin, isUserLoading } = useRole();
    const db = getFirestore();
    const { toast } = useToast();

    // Query for instructors awaiting approval
    const pendingInstructorsQuery = useMemoFirebase(() => {
        return query(
            collection(db, 'users'), 
            where('role', '==', 'instructor'),
            where('isInstructorApproved', '==', false)
        );
    }, [db]);
    const { data: pendingInstructors, isLoading: instructorsLoading, error: instructorsError } = useCollection<FormaAfriqueUser>(pendingInstructorsQuery);

    // Query for courses pending review
    const pendingCoursesQuery = useMemoFirebase(() => {
        return query(collection(db, 'courses'), where('status', '==', 'Pending Review'));
    }, [db]);
    const { data: pendingCourses, isLoading: coursesLoading, error: coursesError } = useCollection<Course>(pendingCoursesQuery);

    const handleApproveInstructor = async (userId: string) => {
        const userRef = doc(db, 'users', userId);
        try {
            await updateDoc(userRef, { isInstructorApproved: true });
            toast({
                title: "Instructeur approuvé !",
                description: "L'utilisateur a maintenant un accès complet en tant qu'instructeur.",
            });
        } catch (error) {
            console.error("Error approving instructor:", error);
            toast({ variant: 'destructive', title: "Erreur", description: "Impossible d'approuver l'instructeur." });
        }
    };
    
    const handleRejectInstructor = async (userId: string) => {
        const userRef = doc(db, 'users', userId);
        try {
            // For now, we just change the role back to student. A better approach might be a dedicated 'rejected' status.
            await updateDoc(userRef, { role: 'student' });
            toast({
                title: "Demande refusée",
                description: "L'utilisateur a été reclassé comme étudiant.",
            });
        } catch (error) {
            console.error("Error rejecting instructor:", error);
            toast({ variant: 'destructive', title: "Erreur", description: "L'opération de refus a échoué." });
        }
    };
    
    const isLoading = isUserLoading || instructorsLoading || coursesLoading;
    const hasError = instructorsError || coursesError;
    
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold dark:text-white">Gestion de la Modération</h1>
                <p className="text-muted-foreground dark:text-slate-400">Approuvez les nouveaux instructeurs et les cours en attente de révision.</p>
            </header>
            
            {hasError && (
                <div className="p-4 bg-destructive/10 text-destructive border border-destructive/50 rounded-lg flex items-center gap-3">
                    <AlertCircle className="h-5 w-5" />
                    <p>Une erreur est survenue lors du chargement des données de modération. Un index Firestore est peut-être manquant.</p>
                </div>
            )}

            <Tabs defaultValue="instructors" className="w-full">
                <TabsList className="grid w-full grid-cols-2 dark:bg-slate-800 dark:text-slate-300">
                    <TabsTrigger value="instructors" className="data-[state=active]:dark:bg-slate-700 data-[state=active]:dark:text-white">
                        <UserCheck className="mr-2 h-4 w-4" />
                        Instructeurs en attente
                        <Badge className="ml-2">{pendingInstructors?.length || 0}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="courses" className="data-[state=active]:dark:bg-slate-700 data-[state=active]:dark:text-white">
                        <Clock className="mr-2 h-4 w-4" />
                        Cours à valider
                        <Badge className="ml-2">{pendingCourses?.length || 0}</Badge>
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="instructors" className="mt-6">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full dark:bg-slate-700" />)}
                        </div>
                    ) : pendingInstructors && pendingInstructors.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pendingInstructors.map(user => (
                                <InstructorRequestCard key={user.uid} user={user} onApprove={handleApproveInstructor} onReject={handleRejectInstructor} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed rounded-lg dark:border-slate-700">
                            <ShieldCheck className="mx-auto h-12 w-12 text-green-500" />
                            <h3 className="mt-4 text-lg font-semibold dark:text-white">Aucune demande d'instructeur en attente.</h3>
                            <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">Tout est à jour !</p>
                        </div>
                    )}
                </TabsContent>
                
                <TabsContent value="courses" className="mt-6">
                    {isLoading ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full dark:bg-slate-700" />)}
                        </div>
                    ) : pendingCourses && pendingCourses.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pendingCourses.map(course => (
                                <CourseReviewCard key={course.id} course={course} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed rounded-lg dark:border-slate-700">
                            <BadgeCheck className="mx-auto h-12 w-12 text-green-500" />
                            <h3 className="mt-4 text-lg font-semibold dark:text-white">Aucun cours à valider.</h3>
                            <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">L'équipe a fait du bon travail !</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
