
'use client';

import { useState, useEffect, useMemo } from 'react';
import { getFirestore, collection, query, where, onSnapshot, orderBy, startAt, endAt, getDocs, limit } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Star, Search, Frown } from 'lucide-react';
import type { Course } from '@/lib/types';
import type { FormaAfriqueUser } from '@/context/RoleContext';
import { useDebounce } from '@/hooks/use-debounce';

const FILTERS = ['Tous', 'Gratuit', 'Design', 'Code', 'Marketing', 'Business'];

const StarRating = ({ rating, reviewCount }: { rating: number, reviewCount: number }) => (
    <div className="flex items-center gap-1 text-xs text-slate-500">
        <span className="font-bold text-amber-500">{rating.toFixed(1)}</span>
        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
        <span>({reviewCount})</span>
    </div>
);

const ResultRow = ({ course, instructor }: { course: Course, instructor: FormaAfriqueUser | null }) => (
    <Link href={`/course/${course.id}`} className="block group">
        <div className="flex gap-4 p-3 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors duration-200">
            <Image
                src={course.imageUrl || `https://picsum.photos/seed/${course.id}/240/135`}
                alt={course.title}
                width={240}
                height={135}
                className="aspect-video object-cover w-32 md:w-40 rounded-lg shrink-0"
            />
            <div className="flex-1 overflow-hidden">
                <h3 className="font-bold text-sm md:text-base text-slate-800 dark:text-slate-100 line-clamp-2 group-hover:text-primary transition-colors">{course.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">Par {instructor?.fullName || 'un instructeur'}</p>
                <div className="flex items-center gap-2 mt-1">
                    <StarRating rating={4.7} reviewCount={123} />
                </div>
                <p className="font-bold text-base text-slate-900 dark:text-white pt-1">
                    {course.price > 0 ? `${course.price.toLocaleString('fr-FR')} FCFA` : 'Gratuit'}
                </p>
            </div>
        </div>
    </Link>
);


export default function SearchPage() {
    const db = getFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('Tous');
    const [results, setResults] = useState<Course[]>([]);
    const [instructors, setInstructors] = useState<Map<string, FormaAfriqueUser>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    useEffect(() => {
        setIsLoading(true);

        const coursesRef = collection(db, 'courses');
        let q = query(coursesRef, where('status', '==', 'Published'));
        
        // Apply text search filter if there is a search term
        if (debouncedSearchTerm) {
            const lowercasedTerm = debouncedSearchTerm.toLowerCase();
            q = query(q, 
                orderBy('title'),
                startAt(lowercasedTerm),
                endAt(lowercasedTerm + '\uf8ff')
            );
        }

        // Apply category/price filter
        if (activeFilter !== 'Tous') {
            if (activeFilter === 'Gratuit') {
                q = query(q, where('price', '==', 0));
            } else {
                q = query(q, where('category', '==', activeFilter));
            }
        }
        
        if (!debouncedSearchTerm && activeFilter === 'Tous') {
            q = query(q, orderBy('createdAt', 'desc'), limit(20));
        }

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const coursesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
            setResults(coursesData);
            
            // Fetch instructors for the new results
            if (coursesData.length > 0) {
                const instructorIds = [...new Set(coursesData.map(c => c.instructorId))].filter(Boolean);
                const newInstructors = new Map(instructors);
                const idsToFetch = instructorIds.filter(id => !newInstructors.has(id));

                if (idsToFetch.length > 0) {
                    const usersQuery = query(collection(db, 'users'), where('uid', 'in', idsToFetch.slice(0, 30)));
                    const usersSnap = await getDocs(usersQuery);
                    usersSnap.forEach(doc => {
                        newInstructors.set(doc.data().uid, doc.data() as FormaAfriqueUser);
                    });
                    setInstructors(newInstructors);
                }
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Search query failed:", error);
            // Firestore might require an index for this query.
            // For now, we'll just show an empty state.
            setResults([]);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [debouncedSearchTerm, activeFilter, db]);

    return (
        <div className="container mx-auto py-6 px-4 space-y-8">
            <header className="sticky top-0 md:top-16 bg-background/80 dark:bg-background-alt/80 backdrop-blur-sm py-4 -mx-4 px-4 z-20">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                        placeholder="Rechercher une compétence, un cours..."
                        className="pl-10 h-12 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-base"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            
                <div className="flex space-x-2 mt-4 overflow-x-auto pb-2">
                    {FILTERS.map(filter => (
                        <Button
                            key={filter}
                            variant={activeFilter === filter ? 'default' : 'outline'}
                            size="sm"
                            className="rounded-full flex-shrink-0"
                            onClick={() => setActiveFilter(filter)}
                        >
                            {filter}
                        </Button>
                    ))}
                </div>
            </header>

            <main className="space-y-4">
                {isLoading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="flex gap-4 p-2">
                            <Skeleton className="w-32 md:w-40 h-[72px] md:h-[90px] rounded-lg dark:bg-slate-700" />
                            <div className="flex-1 space-y-2 py-1">
                                <Skeleton className="h-4 w-3/4 dark:bg-slate-700" />
                                <Skeleton className="h-3 w-1/4 dark:bg-slate-700" />
                                <Skeleton className="h-4 w-1/2 dark:bg-slate-700" />
                            </div>
                        </div>
                    ))
                ) : results.length > 0 ? (
                    results.map(course => (
                        <ResultRow key={course.id} course={course} instructor={instructors.get(course.instructorId) || null} />
                    ))
                ) : (
                    <div className="text-center py-20 px-4 border-2 border-dashed rounded-xl dark:border-slate-700">
                        <Frown className="mx-auto h-12 w-12 text-slate-400" />
                        <h3 className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-200">
                            Oups ! Aucun cours trouvé.
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Essayez un autre mot-clé ou filtre. Vous ne trouvez pas ce que vous cherchez ?</p>
                         <Button variant="link" asChild>
                            <a href="mailto:support@formaafrique.com?subject=Suggestion de cours">Suggérez-nous un sujet !</a>
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
