
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useDoc, useMemoFirebase } from '@/firebase';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowLeft, BookText, Eye, Info, ListVideo, Loader2, Sparkles, Tag, CheckCircle, Send } from 'lucide-react';
import type { Course } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/context/RoleContext';

const StudioNav = () => {
    const { courseId } = useParams();
    const pathname = usePathname();
     const navItems = [
        { href: `/instructor/courses/edit/${courseId}`, label: "Informations" },
        { href: `/instructor/courses/edit/${courseId}/content`, label: "Programme" },
        { href: `/instructor/courses/edit/${courseId}/resources`, label: "Ressources" },
        { href: `/instructor/courses/edit/${courseId}/pricing`, label: "Prix & Promo" },
    ];

    return (
        <div className="border-b dark:border-slate-700">
            <nav className="flex space-x-4 overflow-x-auto px-4 lg:px-6 -mb-px">
                {navItems.map(item => {
                    const isActive = pathname === item.href;
                    return (
                        <Link 
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "py-4 px-1 inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap",
                                "border-b-2 border-transparent",
                                isActive 
                                    ? "text-primary border-primary" 
                                    : "text-muted-foreground hover:text-foreground hover:border-border"
                            )}
                        >
                            {item.label}
                        </Link>
                    )
                })}
            </nav>
        </div>
    );
};


export default function CourseEditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    const { courseId } = useParams();
    const db = getFirestore();
    const { toast } = useToast();
    const { formaAfriqueUser } = useRole();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const courseRef = useMemoFirebase(() => doc(db, 'courses', courseId as string), [db, courseId]);
    const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseRef);
    
    const getStatusBadgeVariant = (status: Course['status'] = 'Draft') => {
        switch (status) {
            case 'Published': return 'default';
            case 'Pending Review': return 'secondary';
            case 'Draft': return 'outline';
            default: return 'outline';
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
    
    const handleAction = async () => {
        if (!course || !formaAfriqueUser) return;
        
        setIsSubmitting(true);
        let newStatus: Course['status'];
        let successTitle = '';
        let successDescription = '';

        if (formaAfriqueUser.role === 'admin') {
            newStatus = 'Published';
            successTitle = 'Cours approuvé et publié !';
            successDescription = 'Le cours est maintenant visible par tous les étudiants.';
        } else {
            newStatus = 'Pending Review';
            successTitle = 'Soumis pour validation !';
            successDescription = 'Votre cours a été envoyé à l\'équipe de modération pour examen.';
        }
        
        const courseDocRef = doc(db, 'courses', courseId as string);

        try {
            await updateDoc(courseDocRef, { status: newStatus });
            toast({
                title: successTitle,
                description: successDescription,
            });
        } catch(error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de changer le statut du cours.' });
            console.error("Error updating course status:", error);
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const renderActionButton = () => {
        if (!course || !formaAfriqueUser) return null;

        if (formaAfriqueUser.role === 'admin') {
            if (course.status === 'Published') return null;
            return (
                <Button size="sm" onClick={handleAction} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                    Approuver & Publier
                </Button>
            );
        }
        
        if (formaAfriqueUser.role === 'instructor') {
             if (course.status === 'Published' || course.status === 'Pending Review') return null;
            return (
                 <Button size="sm" onClick={handleAction} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                    Soumettre pour validation
                </Button>
            );
        }

        return null;
    }


    return (
        <div className="w-full min-h-screen bg-background-alt dark:bg-[#0f172a]">
             <header className="flex h-14 lg:h-[60px] items-center gap-4 border-b bg-card dark:bg-[#1e293b] dark:border-slate-700 px-4 lg:px-6 sticky top-0 z-30">
                <div className="flex-1 flex items-center gap-4">
                     <Link href="/instructor/courses" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-5 w-5" />
                        <span className="sr-only">Retour</span>
                    </Link>
                    {isCourseLoading ? <Skeleton className="h-6 w-1/2 dark:bg-slate-700" /> : (
                        <h1 className="font-semibold text-lg truncate text-foreground dark:text-white">{course?.title || 'Chargement...'}</h1>
                    )}
                </div>
                {isCourseLoading ? <Skeleton className="h-7 w-20 rounded-md dark:bg-slate-700" /> : (
                     <Badge variant={getStatusBadgeVariant(course?.status)} className="capitalize dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
                        {getStatusBadgeText(course?.status)}
                    </Badge>
                )}
                <Button variant="outline" size="sm" asChild className="dark:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-white">
                    <Link href={`/course/${courseId}`} target="_blank">
                        <Eye className="mr-2 h-4 w-4"/> Aperçu
                    </Link>
                </Button>
                 {renderActionButton()}
            </header>
            
            <div className="bg-card dark:bg-[#1e293b]">
                <StudioNav />
            </div>

            <main className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8 xl:p-10">
                {children}
            </main>
        </div>
    );
}
