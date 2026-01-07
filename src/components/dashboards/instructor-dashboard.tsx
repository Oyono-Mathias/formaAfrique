
'use client';

import { useRole } from '@/context/RoleContext';
import { useLanguage } from '@/context/LanguageContext';
import { collection, query, where, getFirestore, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, CartesianGrid, XAxis, YAxis, Bar, ResponsiveContainer } from 'recharts';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '../ui/skeleton';
import { Users, Star, BookOpen, DollarSign } from 'lucide-react';
import type { Course, Review, Enrollment } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface RevenueDataPoint {
    month: string;
    revenue: number;
}

const StatCard = ({ title, value, icon: Icon, isLoading, change, accentColor }: { title: string, value: string, icon: React.ElementType, isLoading: boolean, change?: string, accentColor?: string }) => (
    <Card className={cn("border-t-4 dark:bg-[#1e293b] dark:border-slate-700", accentColor)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium dark:text-slate-400">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <Skeleton className="h-8 w-3/4 dark:bg-slate-700" />
            ) : (
                <>
                    <div className="text-2xl font-bold dark:text-white">{value}</div>
                    {change && <p className="text-xs text-muted-foreground dark:text-slate-500">{change}</p>}
                </>
            )}
        </CardContent>
    </Card>
);


export function InstructorDashboard() {
    const { formaAfriqueUser: instructor, loading: roleLoading } = useRole();
    const { t } = useLanguage();
    const db = getFirestore();

    const [stats, setStats] = useState({
        totalStudents: 0,
        averageRating: 0,
        totalReviews: 0,
        publishedCourses: 0,
        monthlyRevenue: 0,
    });
    const [courses, setCourses] = useState<Course[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [revenueTrendData, setRevenueTrendData] = useState<RevenueDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!instructor?.uid || roleLoading) {
            if (!roleLoading) setIsLoading(false);
            return () => {};
        }

        setIsLoading(true);
        const instructorId = instructor.uid;
        const unsubs: (()=>void)[] = [];

        const coursesQuery = query(collection(db, 'courses'), where('instructorId', '==', instructorId));
        const unsubCourses = onSnapshot(coursesQuery, (coursesSnapshot) => {
            const courseList = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
            setCourses(courseList);
            setStats(prev => ({ ...prev, publishedCourses: courseList.filter(c => c.status === 'Published').length }));

            const courseIds = courseList.map(c => c.id);
            if (courseIds.length === 0) {
                 setIsLoading(false);
                 setEnrollments([]);
                 setStats(prev => ({ ...prev, totalStudents: 0, totalReviews: 0, averageRating: 0, monthlyRevenue: 0 }));
                 setRevenueTrendData([]);
                 return;
            }

            // Firestore 'in' query is limited to 30 items. Batching is needed for larger scale.
            const courseIdChunks: string[][] = [];
            for (let i = 0; i < courseIds.length; i += 30) {
                courseIdChunks.push(courseIds.slice(i, i + 30));
            }

            courseIdChunks.forEach(chunk => {
                const reviewsQuery = query(collection(db, 'reviews'), where('courseId', 'in', chunk));
                const unsubReviews = onSnapshot(reviewsQuery, (reviewSnapshot) => {
                    const reviewList = reviewSnapshot.docs.map(doc => doc.data() as Review);
                    const totalRating = reviewList.reduce((acc, r) => acc + r.rating, 0);
                    setStats(prev => ({
                        ...prev,
                        totalReviews: reviewList.length,
                        averageRating: reviewList.length > 0 ? totalRating / reviewList.length : 0,
                    }));
                });
                unsubs.push(unsubReviews);

                const enrollmentsQuery = query(collection(db, 'enrollments'), where('courseId', 'in', chunk));
                const unsubEnrollments = onSnapshot(enrollmentsQuery, (enrollmentSnapshot) => {
                    const enrollmentList = enrollmentSnapshot.docs.map(doc => doc.data() as Enrollment);
                    setEnrollments(enrollmentList);
                    const uniqueStudents = new Set(enrollmentList.map(e => e.studentId));
                    setStats(prev => ({ ...prev, totalStudents: uniqueStudents.size }));
                });
                unsubs.push(unsubEnrollments);
            });


            const paymentsQuery = query(collection(db, 'payments'), where('instructorId', '==', instructorId));
            const unsubPayments = onSnapshot(paymentsQuery, (paymentSnapshot) => {
                const now = new Date();
                const startOfCurrentMonth = startOfMonth(now);
                
                const monthlyRev = paymentSnapshot.docs
                    .map(d => d.data())
                    .filter(p => p.date && p.date.toDate() >= startOfCurrentMonth)
                    .reduce((sum, p) => sum + (p.amount || 0), 0);

                const monthlyAggregates: Record<string, number> = {};
                paymentSnapshot.docs.forEach(doc => {
                    const payment = doc.data();
                    if (payment.date instanceof Timestamp) {
                        const date = payment.date.toDate();
                        const monthKey = format(date, 'MMM yy', { locale: fr });
                        monthlyAggregates[monthKey] = (monthlyAggregates[monthKey] || 0) + (payment.amount || 0);
                    }
                });

                const trendData = Object.entries(monthlyAggregates)
                    .map(([month, revenue]) => ({ month, revenue }))
                    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

                setRevenueTrendData(trendData);
                setStats(prev => ({ ...prev, monthlyRevenue: monthlyRev }));
                setIsLoading(false);
            });
            unsubs.push(unsubPayments);

        }, (error) => {
            console.error("Error fetching courses:", error);
            setIsLoading(false);
        });
        
        unsubs.push(unsubCourses);

        return () => {
            unsubs.forEach(unsub => unsub());
        };
    }, [instructor?.uid, db, roleLoading]);

    const topCourses = useMemo(() => {
        const courseEnrollmentCounts = enrollments.reduce((acc, enrollment) => {
            acc[enrollment.courseId] = (acc[enrollment.courseId] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return courses
            .map(course => ({
                ...course,
                enrollmentCount: courseEnrollmentCounts[course.id] || 0,
            }))
            .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
            .slice(0, 5);
    }, [courses, enrollments]);

    const chartConfig = {
        revenue: { label: 'Revenus', color: 'hsl(var(--primary))' },
    };


    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold dark:text-white">{t('dashboardTitle')}</h1>
                <p className="text-muted-foreground dark:text-slate-400">Bienvenue, {instructor?.fullName || 'Instructeur'}! Voici un aperçu de vos activités.</p>
            </header>

            <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    title="Étudiants" 
                    value={stats.totalStudents.toLocaleString()} 
                    icon={Users} 
                    isLoading={isLoading} 
                    accentColor="border-blue-500"
                />
                <StatCard 
                    title="Note Moyenne" 
                    value={stats.totalReviews > 0 ? stats.averageRating.toFixed(1) : "N/A"} 
                    icon={Star} 
                    isLoading={isLoading} 
                    change={stats.totalReviews > 0 ? `Basé sur ${stats.totalReviews} avis` : "En attente d'avis"}
                />
                <StatCard 
                    title={t('publishedCourses')}
                    value={stats.publishedCourses.toString()} 
                    icon={BookOpen} 
                    isLoading={isLoading}
                    accentColor="border-purple-500"
                />
                <StatCard 
                    title={t('monthlyRevenue')}
                    value={`${stats.monthlyRevenue.toLocaleString('fr-FR')} XOF`} 
                    icon={DollarSign} 
                    isLoading={isLoading}
                    accentColor="border-green-500"
                />
            </section>

            <section className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <h2 className="text-2xl font-semibold mb-4 dark:text-white">Tendance des revenus</h2>
                    <Card className="dark:bg-[#1e293b] dark:border-slate-700">
                        <CardContent className="pt-6">
                            {isLoading ? <Skeleton className="h-72 w-full dark:bg-slate-700" /> : (
                                <ChartContainer config={chartConfig} className="h-72 w-full">
                                    <ResponsiveContainer>
                                        <BarChart data={revenueTrendData}>
                                            <CartesianGrid vertical={false} strokeDasharray="3 3" className="dark:stroke-slate-700" />
                                            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} className="dark:fill-slate-400" />
                                            <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} className="dark:fill-slate-400"/>
                                            <ChartTooltip
                                                cursor={false}
                                                content={<ChartTooltipContent
                                                    indicator="dot"
                                                    className="dark:bg-slate-800 dark:border-slate-600"
                                                />}
                                            />
                                            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={8} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div>
                     <h2 className="text-2xl font-semibold mb-4 dark:text-white">Top 5 des Cours</h2>
                      <Card className="dark:bg-[#1e293b] dark:border-slate-700">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="dark:border-slate-700">
                                        <TableHead className="dark:text-slate-400">Cours</TableHead>
                                        <TableHead className="text-right dark:text-slate-400">Inscriptions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? [...Array(5)].map((_, i) => (
                                        <TableRow key={i} className="dark:border-slate-700">
                                            <TableCell><Skeleton className="h-5 w-32 dark:bg-slate-700" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-5 w-10 dark:bg-slate-700" /></TableCell>
                                        </TableRow>
                                    )) : topCourses.map(course => (
                                        <TableRow key={course.id} className="dark:border-slate-700 dark:hover:bg-slate-800/50">
                                            <TableCell className="font-medium truncate max-w-xs dark:text-slate-200">{course.title}</TableCell>
                                            <TableCell className="text-right font-bold dark:text-white">{course.enrollmentCount}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                      </Card>
                </div>
            </section>
        </div>
    );
}
