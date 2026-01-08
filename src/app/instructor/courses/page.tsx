
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRole } from '@/context/RoleContext';
import { useCollection, useMemoFirebase } from '@/firebase';
import { getFirestore, collection, query, where, getCountFromServer, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Search, Users, BookOpen, Trash2, Edit } from 'lucide-react';
import type { Course } from '@/lib/types';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


function CourseCard({ course, onDelete }: { course: Course, onDelete: (courseId: string) => void }) {
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const db = getFirestore();
  const { t } = useTranslation();

  useEffect(() => {
    const getCount = async () => {
      setLoadingCount(true);
      const q = query(collection(db, 'enrollments'), where('courseId', '==', course.id));
      const snapshot = await getCountFromServer(q);
      setEnrollmentCount(snapshot.data().count);
      setLoadingCount(false);
    };
    getCount();
  }, [course.id, db]);

  const handleDeleteClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsAlertOpen(true);
  };
  
  const confirmDelete = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDelete(course.id);
      setIsAlertOpen(false);
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden transition-shadow duration-300 hover:shadow-lg flex flex-col">
        <Link href={`/instructor/courses/edit/${course.id}`} className="block">
            <Image
              src={course.imageUrl || `https://picsum.photos/seed/${course.id}/300/170`}
              alt={course.title}
              width={300}
              height={170}
              className="aspect-video object-cover w-full h-28"
            />
        </Link>
        <div className="p-2.5 flex flex-col flex-grow">
          <h3 className="font-bold text-xs text-slate-800 line-clamp-2 h-8">{course.title}</h3>
          <div className="flex-grow"></div>
          <div className="flex items-center justify-between mt-1">
            {loadingCount ? <Skeleton className="h-4 w-16" /> : (
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Users className="w-3 h-3 text-slate-400" />
                    <span>{t('studentLabel', { count: enrollmentCount })}</span>
                </div>
            )}
             <div className="flex items-center gap-0.5">
                 <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-primary" asChild>
                    <Link href={`/instructor/courses/edit/${course.id}`}><Edit className="h-3.5 w-3.5" /></Link>
                 </Button>
                 <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-destructive" onClick={handleDeleteClick}>
                     <Trash2 className="h-3.5 w-3.5" />
                 </Button>
             </div>
          </div>
        </div>
      </div>
      
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>{t('deleteCourseConfirmationTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                      {t('deleteCourseConfirmationMessage', { courseTitle: course.title })}
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancelButton')}</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                      {t('deleteButton')}
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function InstructorCoursesPage() {
  const { formaAfriqueUser, isUserLoading } = useRole();
  const db = getFirestore();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const coursesQuery = useMemoFirebase(
    () => formaAfriqueUser?.uid
      ? query(collection(db, 'courses'), where('instructorId', '==', formaAfriqueUser.uid))
      : null,
    [db, formaAfriqueUser?.uid]
  );
  const { data: courses, isLoading: coursesLoading } = useCollection<Course>(coursesQuery);

  const filteredCourses = useMemo(() => {
    if (!courses) return [];
    return courses.filter(course =>
      course.title?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [courses, searchTerm]);
  
  const handleDeleteCourse = async (courseId: string) => {
    try {
        await deleteDoc(doc(db, 'courses', courseId));
        // Note: Subcollections like sections, lectures, etc., are not deleted automatically.
        // A cloud function would be needed for cascading deletes in a production app.
        toast({
            title: t('courseDeletedTitle'),
            description: t('courseDeletedMessage'),
        });
    } catch (error) {
        console.error("Error deleting course:", error);
        toast({
            variant: "destructive",
            title: t('errorTitle'),
            description: t('courseDeletionErrorMessage'),
        });
    }
  };

  const isLoading = isUserLoading || coursesLoading;

  return (
    <div className="p-4 md:p-6 space-y-6 bg-white min-h-screen">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">{t('navMyCourses')}</h1>
        <p className="text-slate-500">{t('myCoursesDescription')}</p>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder={t('searchCoursePlaceholder')}
          className="pl-10 bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-500 focus-visible:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filteredCourses.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCourses.map(course => (
            <CourseCard key={course.id} course={course} onDelete={handleDeleteCourse} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl mt-8">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-600">{t('noCoursesFoundTitle')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('noCoursesFoundMessage')}</p>
        </div>
      )}
      
      <Button asChild className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90">
        <Link href="/instructor/courses/create">
          <PlusCircle className="h-6 w-6" />
          <span className="sr-only">{t('createNewCourse')}</span>
        </Link>
      </Button>
    </div>
  );
}
