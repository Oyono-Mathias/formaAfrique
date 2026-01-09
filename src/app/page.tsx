
'use client';

import Link from 'next/link';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getFirestore, getDocs, limit, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Star, Frown, BookText, Video, Award, Users, BookOpen, Clock, Linkedin, Twitter, Youtube } from "lucide-react";
import Image from 'next/image';
import { useMemo, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Course } from '@/lib/types';
import type { FormaAfriqueUser } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useRole } from '@/context/RoleContext';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Footer } from '@/components/layout/footer';

const StarRating = ({ rating, reviewCount }: { rating: number, reviewCount: number }) => (
    <div className="flex items-center gap-1 text-xs text-white/80">
        <span className="font-bold text-amber-400">{rating.toFixed(1)}</span>
        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
        <span>({reviewCount.toLocaleString()})</span>
    </div>
);

const CourseCard = ({ course, instructor }: { course: Course, instructor: Partial<FormaAfriqueUser> | null }) => {
    const isEbook = course.contentType === 'ebook';
    return (
        <div className="w-full">
            <Link href={`/course/${course.id}`} className="block group">
                <div className="overflow-hidden bg-slate-800/50 border border-slate-700/80 shadow-lg transition-all duration-300 group-hover:shadow-primary/20 group-hover:-translate-y-1 rounded-2xl">
                    <div className="relative">
                        <Image
                            src={course.imageUrl || `https://picsum.photos/seed/${course.id}/300/170`}
                            alt={course.title}
                            width={300}
                            height={170}
                            className="aspect-video object-cover w-full"
                        />
                         <Badge variant="secondary" className="absolute top-3 left-3 bg-black/50 text-white/90 border-slate-700 flex items-center gap-1.5">
                            {isEbook ? <BookText className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                            {isEbook ? 'E-book' : 'Vidéo'}
                         </Badge>
                    </div>
                    <div className="p-4 space-y-2">
                        <h3 className="font-bold text-base text-slate-100 line-clamp-2 h-12 group-hover:text-primary transition-colors">{course.title}</h3>
                        <p className="text-sm text-slate-400 truncate">Par {instructor?.fullName || 'un instructeur'}</p>
                        <div className="flex justify-between items-center pt-1">
                            <StarRating rating={4.7} reviewCount={123} />
                            <p className="font-bold text-lg text-white">
                              {course.price > 0 ? `${course.price.toLocaleString('fr-FR')} XOF` : 'Gratuit'}
                            </p>
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
};

const StatItem = ({ value, label, icon: Icon }: { value: string, label: string, icon: React.ElementType }) => (
    <div className="flex flex-col items-center text-center">
        <Icon className="h-10 w-10 text-primary mb-2" />
        <p className="text-3xl font-extrabold text-white">{value}</p>
        <p className="text-sm text-slate-400">{label}</p>
    </div>
);

const FeatureItem = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl text-center">
        <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400">{description}</p>
    </div>
);

export default function LandingPage() {
  const db = getFirestore();
  const [instructorsMap, setInstructorsMap] = useState<Map<string, Partial<FormaAfriqueUser>>>(new Map());
  const router = useRouter();
  const { user, isUserLoading } = useRole();

  const coursesQuery = useMemoFirebase(() => {
    return query(collection(db, 'courses'), where('status', '==', 'Published'), orderBy('isPopular', 'desc'), limit(4));
  }, [db]);

  const { data: courses, isLoading: coursesLoading } = useCollection<Course>(coursesQuery);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    const processData = async () => {
        if (coursesLoading || !courses) return;
        const neededInstructorIds = [...new Set(courses.map(c => c.instructorId).filter(id => !instructorsMap.has(id)))];
        if (neededInstructorIds.length > 0) {
            const usersQuery = query(collection(db, 'users'), where('uid', 'in', neededInstructorIds.slice(0, 10)));
            const userSnapshots = await getDocs(usersQuery);
            const newInstructors = new Map(instructorsMap);
            userSnapshots.forEach(doc => newInstructors.set(doc.data().uid, doc.data()));
            setInstructorsMap(newInstructors);
        }
    };
    processData();
  }, [courses, coursesLoading, db, instructorsMap]);

  if (isUserLoading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background dark:bg-[#0f172a]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full bg-[#0f172a] text-white">
      <header className="absolute top-0 left-0 right-0 z-50 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icon.svg" alt="FormaAfrique Logo" width={32} height={32} />
            <span className="font-bold text-xl">FormaAfrique</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            <Link href="/search" className="text-sm font-medium text-slate-300 hover:text-white">Cours</Link>
            <Link href="/devenir-instructeur" className="text-sm font-medium text-slate-300 hover:text-white">Devenir Formateur</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="hover:bg-slate-800 hover:text-white">
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground hidden sm:flex">
              <Link href="/login?tab=register">S'inscrire</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-28 text-center overflow-hidden">
          <div className="absolute inset-0 bg-grid-slate-700/40 [mask-image:linear-gradient(to_bottom,white_20%,transparent_100%)]"></div>
          <div className="container mx-auto px-4 relative">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 mb-4">La plateforme N°1 au Cameroun</Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">Apprenez des compétences d'avenir avec FormaAfrique</h1>
            <p className="max-w-3xl mx-auto mt-6 text-lg md:text-xl text-slate-300">Des formations de qualité, accessibles partout, pour booster votre carrière en Afrique.</p>
            <div className="mt-8 flex justify-center gap-4">
              <Button size="lg" asChild className="h-12 px-8 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/search">Explorer les cours</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="h-12 px-8 text-base bg-green-600 text-white hover:bg-green-700">
                <Link href="/login?tab=register">S'inscrire gratuitement</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-slate-900/50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <StatItem value="500+" label="Étudiants" icon={Users} />
              <StatItem value="20+" label="Formations" icon={BookOpen} />
              <StatItem value="Reconnus" label="Certificats" icon={Award} />
            </div>
          </div>
        </section>

        {/* Popular Courses Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Nos formations les plus populaires</h2>
            {coursesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80 w-full rounded-2xl bg-slate-800" />)}
                </div>
            ) : courses && courses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {courses.map(course => (
                        <CourseCard key={course.id} course={course} instructor={instructorsMap.get(course.instructorId) || null} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 px-4 border-2 border-dashed border-slate-700 rounded-xl">
                    <Frown className="mx-auto h-12 w-12 text-slate-500" />
                    <h3 className="mt-4 text-lg font-semibold">Aucun cours populaire pour le moment.</h3>
                    <p className="mt-1 text-sm text-slate-400">Nos formateurs préparent du nouveau contenu !</p>
                </div>
            )}
          </div>
        </section>

        {/* Why Us Section */}
        <section className="py-20 bg-slate-900/50">
            <div className="container mx-auto px-4">
                <h2 className="text-3xl font-bold text-center mb-12">Pourquoi choisir FormaAfrique ?</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureItem icon={Clock} title="Apprentissage flexible" description="Accédez à vos cours 24/7 sur mobile ou ordinateur et apprenez à votre propre rythme." />
                    <FeatureItem icon={Users} title="Experts locaux" description="Nos formateurs sont des professionnels expérimentés et reconnus dans leur domaine en Afrique." />
                    <FeatureItem icon={Award} title="Accès à vie" description="Une fois inscrit, vous avez un accès à vie au contenu du cours et à toutes ses mises à jour." />
                </div>
            </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
