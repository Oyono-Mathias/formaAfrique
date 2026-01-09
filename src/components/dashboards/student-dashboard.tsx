
'use client';

import Link from 'next/link';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getFirestore, getDocs, limit, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Star, Frown, BookText, Video, Share } from "lucide-react";
import Image from 'next/image';
import { useMemo, useState, useEffect } from 'react';
import { Skeleton } from '../ui/skeleton';
import type { Course } from '@/lib/types';
import type { FormaAfriqueUser } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { useTranslation } from 'react-i18next';

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.04 2.01C6.58 2.01 2.13 6.46 2.13 12.02c0 1.76.46 3.45 1.32 4.94L2.05 22l5.3-1.4c1.42.82 3.02 1.28 4.69 1.28h.01c5.46 0 9.91-4.45 9.91-9.91s-4.45-9.9-9.91-9.9zM12.04 20.2c-1.45 0-2.84-.38-4.06-1.08l-.3-.18-3.03.8.82-2.96-.2-.32a8.03 8.03 0 01-1.23-4.45c0-4.43 3.6-8.03 8.03-8.03s8.03 3.6 8.03 8.03-3.6 8.02-8.03 8.02zm4.45-6.21c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-1.25-.87-1.57-1.6-1.61-1.72-.04-.12 0-.18.11-.3.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.42-.54-.42h-.47c-.16 0-.42.06-.64.3.22.24-.88.85-.88,2.07s.9,2.4,1.02,2.56c.12.16,1.78,2.73,4.31,3.8.59.25,1.05.4,1.41.52.6.2,1.14.16,1.56.1.48-.07,1.42-.58,1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z"></path>
    </svg>
);

const StarRating = ({ rating, reviewCount }: { rating: number, reviewCount: number }) => (
    <div className="flex items-center gap-1 text-xs text-slate-500">
        <span className="font-bold text-amber-500">{rating.toFixed(1)}</span>
        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
        <span>({reviewCount.toLocaleString()})</span>
    </div>
);

const CourseCard = ({ course, instructor }: { course: Course, instructor: Partial<FormaAfriqueUser> | null }) => {
    const isEbook = course.contentType === 'ebook';
    return (
        <div className="w-full">
            <Link href={`/course/${course.id}`} className="block group">
                <div className="overflow-hidden bg-white border border-slate-200 shadow-sm transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1 rounded-2xl">
                    <div className="relative">
                        <Image
                            src={course.imageUrl || `https://picsum.photos/seed/${course.id}/300/170`}
                            alt={course.title}
                            width={300}
                            height={170}
                            className="aspect-video object-cover w-full"
                        />
                         <Badge variant="secondary" className="absolute top-3 left-3 bg-white/80 backdrop-blur-sm flex items-center gap-1.5">
                            {isEbook ? <BookText className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                            {isEbook ? 'E-book' : 'Vidéo'}
                         </Badge>
                    </div>
                    <div className="p-4 space-y-2">
                        <h3 className="font-bold text-sm text-slate-800 line-clamp-2 h-10">{course.title}</h3>
                        <p className="text-xs text-slate-500 truncate">Par {instructor?.fullName || 'un instructeur'}</p>
                        <div className="flex justify-between items-center pt-1">
                            <StarRating rating={4.7} reviewCount={123} />
                            <p className="font-bold text-base text-slate-900">
                              {course.price > 0 ? `${course.price.toLocaleString('fr-FR')} XOF` : 'Gratuit'}
                            </p>
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
};

export function StudentDashboard() {
  const db = getFirestore();
  const { t } = useTranslation();
  const [instructorsMap, setInstructorsMap] = useState<Map<string, Partial<FormaAfriqueUser>>>(new Map());
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const coursesQuery = useMemoFirebase(() => {
    let q = query(collection(db, 'courses'), where('status', '==', 'Published'));
    if (selectedCategory && selectedCategory !== 'Populaires') {
        q = query(q, where('category', '==', selectedCategory));
    } else {
        q = query(q, orderBy('isPopular', 'desc'), limit(12));
    }
    return q;
  }, [db, selectedCategory]);

  const { data: courses, isLoading: coursesLoading } = useCollection<Course>(coursesQuery);

  useEffect(() => {
    const fetchCategories = async () => {
        setCategoriesLoading(true);
        try {
            const allCoursesQuery = query(collection(db, 'courses'), where('status', '==', 'Published'));
            const snapshot = await getDocs(allCoursesQuery);
            const uniqueCategories = new Set(snapshot.docs.map(doc => doc.data().category).filter(Boolean));
            setCategories(['Populaires', ...Array.from(uniqueCategories)]);
        } catch (error) {
            console.error("Failed to fetch categories:", error);
        } finally {
            setCategoriesLoading(false);
        }
    }
    fetchCategories();
  },[db]);

  useEffect(() => {
    const processData = async () => {
        if (coursesLoading || !courses) return;
        const neededInstructorIds = [...new Set(courses.map(c => c.instructorId).filter(id => !instructorsMap.has(id)))];
        if (neededInstructorIds.length > 0) {
            const usersQuery = query(collection(db, 'users'), where('uid', 'in', neededInstructorIds.slice(0, 30)));
            const userSnapshots = await getDocs(usersQuery);
            const newInstructors = new Map(instructorsMap);
            userSnapshots.forEach(doc => newInstructors.set(doc.data().uid, doc.data()));
            setInstructorsMap(newInstructors);
        }
    };
    processData();
  }, [courses, coursesLoading, db, instructorsMap]);

  const whatsappShareLink = `https://wa.me/?text=${encodeURIComponent(t('whatsappShareText', { siteUrl: 'https://formaafrique-app.web.app' }))}`;
  
  return (
    <div className="space-y-12 pb-20">
      <section className="text-center pt-8 md:pt-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Dominez votre futur avec des compétences réelles</h1>
          <p className="max-w-2xl mx-auto mt-4 text-slate-600 text-lg">La meilleure formation en ligne au Cameroun, accessible via Orange Money et MTN MoMo. Apprenez un métier et changez votre avenir.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild className="h-14 px-8 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
                <Link href="/search">Explorer les cours</Link>
              </Button>
               <Button size="lg" variant="outline" asChild className="h-14 px-8 text-base font-bold bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                  <a href={whatsappShareLink} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="h-5 w-5 mr-2" />
                    Inviter un ami
                  </a>
               </Button>
          </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold mb-6 text-slate-900 text-center">Explorez nos formations</h2>
         <div className="border-b mb-6">
          <div className="flex items-center justify-center space-x-2 overflow-x-auto pb-3 no-scrollbar">
            {categoriesLoading ? (
                [...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)
            ) : (
                categories.map(category => (
                    <Button 
                        key={category} 
                        variant={(selectedCategory === category || (!selectedCategory && category === 'Populaires')) ? "default" : "outline"} 
                        size="sm" 
                        className="rounded-full flex-shrink-0 h-9 px-4"
                        onClick={() => setSelectedCategory(category === 'Populaires' ? null : category)}
                    >
                        {category}
                    </Button>
                ))
            )}
          </div>
         </div>
         
        {coursesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-2xl" />)}
            </div>
        ) : courses && courses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
                {courses.map(course => (
                    <CourseCard key={course.id} course={course} instructor={instructorsMap.get(course.instructorId) || null} />
                ))}
            </div>
        ) : (
            <div className="text-center py-16 px-4 border-2 border-dashed rounded-xl">
                <Frown className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-4 text-lg font-semibold text-slate-700">
                    Nos experts préparent vos formations...
                </h3>
                <p className="mt-1 text-sm text-slate-500">Revenez très vite pour découvrir nos nouveaux cours !</p>
            </div>
        )}
      </section>
    </div>
  );
}

    