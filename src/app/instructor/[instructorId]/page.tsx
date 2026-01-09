
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { useRole } from '@/context/RoleContext';
import { doc, collection, query, where, getFirestore, getDocs, getCountFromServer, addDoc, serverTimestamp, limit, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Star, Globe, Twitter, Linkedin, Youtube, MessageCircle, Edit, ShieldAlert, Users, BookOpen } from 'lucide-react';
import type { Course } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const StatCard = ({ value, label }: { value: string, label: string }) => (
    <div className="text-center">
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-gray-400">{label}</p>
    </div>
);

const StarRating = ({ rating, reviewCount }: { rating: number, reviewCount: number }) => (
    <div className="flex items-center gap-1 text-sm">
        <p className="font-bold text-amber-400">{rating.toFixed(1)}</p>
        <div className="flex">
            {[...Array(5)].map((_, i) => (
                <Star key={i} className={cn("w-4 h-4", i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-600 text-gray-700")} />
            ))}
        </div>
        <p className="text-gray-400">({reviewCount})</p>
    </div>
);

const CourseCard = ({ course }: { course: Course }) => {
    return (
        <Link href={`/course/${course.id}`} className="block group">
            <div className="bg-gray-800 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-primary/10">
                <Image 
                    src={course.imageUrl || `https://picsum.photos/seed/${course.id}/300/170`}
                    alt={course.title}
                    width={300}
                    height={170}
                    className="aspect-video object-cover w-full"
                />
                <div className="p-4">
                    <h3 className="font-bold truncate text-base group-hover:text-primary transition-colors">{course.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">Catégorie: {course.category}</p>
                    <div className="flex items-baseline gap-2 mt-2">
                        <p className="font-bold text-lg">{(course.price || 0).toLocaleString('fr-FR')} FCFA</p>
                    </div>
                </div>
            </div>
        </Link>
    );
};

const SocialLink = ({ href, icon: Icon, label }: { href?: string, icon: React.ElementType, label: string }) => {
    if (!href) return null;
    return (
        <Link href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-3 hover:bg-gray-800 rounded-lg transition-colors text-gray-300 hover:text-white">
            <Icon className="w-5 h-5" />
            <span>{label}</span>
        </Link>
    )
}

export default function InstructorProfilePage() {
    const { instructorId } = useParams();
    const router = useRouter();
    const db = getFirestore();
    const { formaAfriqueUser: currentUser } = useRole();
    const { toast } = useToast();

    const [stats, setStats] = useState({ studentCount: 0, reviewCount: 0 });
    const [statsLoading, setStatsLoading] = useState(true);

    const instructorRef = useMemoFirebase(() => doc(db, 'users', instructorId as string), [db, instructorId]);
    const { data: instructor, isLoading: instructorLoading } = useDoc(instructorRef);

    const coursesQuery = useMemoFirebase(() => 
        query(collection(db, 'courses'), where('instructorId', '==', instructorId), where('status', '==', 'Published')),
        [db, instructorId]
    );
    const { data: courses, isLoading: coursesLoading } = useCollection<Course>(coursesQuery);

    useEffect(() => {
        const fetchStats = async () => {
            if (!courses || courses.length === 0) {
                setStats({ studentCount: 0, reviewCount: 0 });
                setStatsLoading(false);
                return;
            }
            if (coursesLoading) return;

            setStatsLoading(true);
            const courseIds = courses.map(c => c.id);
            
            try {
                // Firestore `in` query limit is 30. For more, batching is required.
                const enrollmentsQuery = query(collection(db, 'enrollments'), where('courseId', 'in', courseIds.slice(0,30)));
                const enrollmentsSnap = await getDocs(enrollmentsQuery);
                const uniqueStudentIds = new Set(enrollmentsSnap.docs.map(doc => doc.data().studentId));
                
                const reviewsQuery = query(collection(db, 'reviews'), where('courseId', 'in', courseIds.slice(0,30)));
                const reviewCountSnap = await getCountFromServer(reviewsQuery);
                
                setStats({
                    studentCount: uniqueStudentIds.size,
                    reviewCount: reviewCountSnap.data().count,
                });
            } catch (error) {
                console.error("Error fetching stats:", error);
                setStats({ studentCount: 0, reviewCount: 0 });
            } finally {
                setStatsLoading(false);
            }
        };

        fetchStats();
    }, [courses, coursesLoading, db]);
    
    const isOwner = currentUser?.uid === instructorId;
    const isLoading = instructorLoading || statsLoading;

    if (isLoading) {
        return (
            <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-12">
                <div className="max-w-4xl mx-auto">
                    <header className="flex flex-col sm:flex-row items-center gap-6 mb-10">
                        <Skeleton className="h-32 w-32 rounded-full" />
                        <div className="space-y-3">
                            <Skeleton className="h-8 w-64" />
                            <Skeleton className="h-5 w-48" />
                        </div>
                    </header>
                     <div className="grid grid-cols-2 gap-4 mb-10">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                    <Skeleton className="h-40 w-full" />
                </div>
            </div>
        )
    }

    if (!instructor) {
        return <div className="text-white text-center py-20">Instructeur non trouvé.</div>;
    }
    
    const socialLinks = instructor.socialLinks || {};

    return (
        <div className="bg-gray-900 text-white min-h-screen">
            <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-12">
                <header className="flex flex-col sm:flex-row items-center gap-6 mb-12">
                    <Avatar className="w-32 h-32 border-4 border-gray-700">
                        <AvatarImage src={instructor.profilePictureURL} />
                        <AvatarFallback className="text-5xl bg-gray-800">{instructor.fullName?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="text-center sm:text-left">
                        <h1 className="text-4xl font-bold">{instructor.fullName || 'Formateur FormaAfrique'}</h1>
                        <p className="text-xl text-primary mt-1">{instructor.careerGoals?.currentRole || `Expert en ${courses?.[0]?.category || 'Tech'}`}</p>
                    </div>
                    {isOwner && (
                         <Button variant="outline" size="sm" onClick={() => router.push('/account')} className="text-white border-gray-600 hover:bg-gray-800 ml-auto hidden sm:flex">
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier le Profil
                        </Button>
                    )}
                </header>

                <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-12">
                         <section>
                            <h2 className="text-2xl font-bold mb-4 border-l-4 border-primary pl-3">À propos de moi</h2>
                            <p className="text-gray-300 leading-relaxed">
                                {instructor.bio || `${instructor.fullName} est un architecte de solutions, consultant et développeur de logiciels qui s'intéresse particulièrement à tout ce qui touche au Cloud et au Big Data.`}
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4 border-l-4 border-primary pl-3">Mes cours ({courses?.length || 0})</h2>
                             {courses && courses.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {courses.map(course => <CourseCard key={course.id} course={course} />)}
                                </div>
                            ) : (
                                <p className="text-gray-400">Cet instructeur n'a pas encore publié de cours.</p>
                            )}
                        </section>
                    </div>

                    <aside className="space-y-8">
                        <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                             <h3 className="text-xl font-bold mb-4">Statistiques</h3>
                             <div className="grid grid-cols-2 gap-4 text-center">
                                 <div className="space-y-1">
                                    <Users className="h-6 w-6 mx-auto text-primary"/>
                                    <p className="text-2xl font-bold">{stats.studentCount.toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">Étudiants</p>
                                 </div>
                                  <div className="space-y-1">
                                    <Star className="h-6 w-6 mx-auto text-primary"/>
                                    <p className="text-2xl font-bold">{stats.reviewCount.toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">Avis</p>
                                 </div>
                                  <div className="space-y-1 col-span-2">
                                    <BookOpen className="h-6 w-6 mx-auto text-primary"/>
                                    <p className="text-2xl font-bold">{(courses?.length || 0)}</p>
                                    <p className="text-xs text-gray-400">Cours publiés</p>
                                 </div>
                             </div>
                        </div>

                         <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                             <h3 className="text-xl font-bold mb-4">Retrouvez-moi sur</h3>
                             <ul className="space-y-2">
                                <SocialLink href={socialLinks.website} icon={Globe} label="Website" />
                                <SocialLink href={socialLinks.twitter} icon={Twitter} label="Twitter" />
                                <SocialLink href={socialLinks.linkedin} icon={Linkedin} label="LinkedIn" />
                                <SocialLink href={socialLinks.youtube} icon={Youtube} label="Youtube" />
                            </ul>
                        </div>
                    </aside>
                </section>
            </div>
        </div>
    );
}
