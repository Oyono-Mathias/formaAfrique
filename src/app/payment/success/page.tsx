
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Download } from 'lucide-react';
import type { Course } from '@/lib/types';


export default function PaymentSuccessPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');

    const [course, setCourse] = useState<Course | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const db = getFirestore();

    useEffect(() => {
        if (!courseId) {
            setIsLoading(false);
            return;
        }

        const fetchCourse = async () => {
            setIsLoading(true);
            const courseRef = doc(db, 'courses', courseId);
            const courseSnap = await getDoc(courseRef);
            if (courseSnap.exists()) {
                setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
            }
            setIsLoading(false);
        };
        fetchCourse();
    }, [courseId, db]);

    return (
        <div className="flex flex-col justify-center items-center min-h-screen gap-6 text-center p-4 bg-slate-50">
            <Card className="w-full max-w-lg shadow-2xl rounded-3xl animate-in fade-in-50 zoom-in-95">
                <CardHeader className="items-center pt-8">
                     <CheckCircle2 className="h-20 w-20 text-green-500 mb-4 animate-pulse" />
                    <CardTitle className="text-3xl font-extrabold text-slate-800">Félicitations !</CardTitle>
                    <p className="text-slate-600 pt-2">Vous venez d'investir en vous-même. Le paiement a été validé avec succès.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading ? (
                         <div className="p-4 border rounded-xl bg-slate-100 flex items-center gap-4">
                            <Skeleton className="h-16 w-24 rounded-lg" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-1/3" />
                            </div>
                        </div>
                    ) : course ? (
                         <div className="p-4 border rounded-xl bg-slate-100/70 flex items-center gap-4 text-left">
                            <Image 
                                src={course.imageUrl || `https://picsum.photos/seed/${course.id}/150/100`}
                                alt={course.title}
                                width={96}
                                height={54}
                                className="rounded-lg aspect-video object-cover"
                            />
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900">{course.title}</h3>
                                <p className="text-xs font-semibold text-green-600 bg-green-100/80 px-2 py-0.5 rounded-full inline-block mt-1">Accès activé</p>
                            </div>
                        </div>
                    ) : null}
                    
                    <Button asChild size="lg" className="w-full h-14 text-base font-bold bg-blue-600 hover:bg-blue-700 rounded-xl">
                        {courseId ? (
                            <Link href={`/courses/${courseId}`}>Commencer ma formation</Link>
                        ) : (
                             <Link href="/dashboard">Aller au tableau de bord</Link>
                        )}
                    </Button>
                </CardContent>
                <CardFooter className="flex-col gap-3 text-xs text-slate-500 pb-8">
                     <p>N° de transaction : TX-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                     <Button variant="link" className="p-0 h-auto">
                        <Download className="mr-2 h-3 w-3" />
                        Recevoir le reçu par e-mail
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
