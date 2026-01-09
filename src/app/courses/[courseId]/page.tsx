
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { useRole } from '@/context/RoleContext';
import { doc, getFirestore, collection, query, orderBy, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CheckCircle, Lock, PlayCircle, BookOpen, ArrowLeft, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Course, Section, Lecture, Enrollment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import 'plyr/dist/plyr.css';
import { useToast } from '@/hooks/use-toast';
import dynamic from 'next/dynamic';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

const ReactPlayer = dynamic(() => import('react-player/lazy'), { ssr: false });
const Worker = dynamic(() => import('@react-pdf-viewer/core').then(mod => mod.Worker), { ssr: false });
const Viewer = dynamic(() => import('@react-pdf-viewer/core').then(mod => mod.Viewer), { ssr: false });


const VideoPlayer = ({ videoUrl, onEnded }: { videoUrl?: string; onEnded?: () => void }) => {
    
    if (!videoUrl) {
        return (
            <div className="aspect-video w-full bg-slate-900 flex items-center justify-center rounded-lg">
                <p className="text-white">Sélectionnez une leçon pour commencer.</p>
            </div>
        );
    }

    return (
       <div className="aspect-video w-full bg-black rounded-lg overflow-hidden video-wrapper shadow-2xl min-h-[200px] relative z-10">
         <ReactPlayer 
            key={videoUrl}
            url={videoUrl} 
            onEnded={onEnded} 
            width="100%" 
            height="100%" 
            controls 
            playing
            playsinline={true}
            config={{
                youtube: {
                    playerVars: { 
                        origin: typeof window !== 'undefined' ? window.location.origin : 'https://formaafrique-app.web.app',
                        autoplay: 0,
                    }
                },
                attributes: {
                    playsInline: true,
                }
            }}
          />
       </div>
    );
};


const CourseSidebar = ({ courseId, activeLesson, onLessonClick, isEnrolled, completedLessons, allLectures }: { courseId: string, activeLesson: Lecture | null, onLessonClick: (lesson: Lecture) => void, isEnrolled: boolean, completedLessons: string[], allLectures: Map<string, Lecture[]> }) => {
    const db = getFirestore();
    const sectionsQuery = useMemoFirebase(() => query(collection(db, 'courses', courseId, 'sections'), orderBy('order')), [db, courseId]);
    const { data: sections, isLoading: sectionsLoading } = useCollection<Section>(sectionsQuery);
    
    // Effect to set the first lesson as active by default
    useEffect(() => {
        if (sections && sections.length > 0 && allLectures.size > 0 && !activeLesson) {
            const firstSectionId = sections[0].id;
            const firstSectionLectures = allLectures.get(firstSectionId);
            if (firstSectionLectures && firstSectionLectures.length > 0) {
                const firstLesson = firstSectionLectures[0];
                 if (isEnrolled || firstLesson.isFreePreview) {
                    onLessonClick(firstLesson);
                 }
            }
        }
    }, [sections, allLectures, activeLesson, onLessonClick, isEnrolled]);

    if (sectionsLoading) {
        return <Skeleton className="h-full w-full" />;
    }
    
    if (!sections || sections.length === 0) {
        return (
            <Card>
                <CardContent className="p-4 text-center text-muted-foreground text-sm">
                    Le programme du cours n'est pas encore disponible.
                </CardContent>
            </Card>
        );
    }
    
    let totalLessons = 0;
    allLectures.forEach(sectionLectures => {
        totalLessons += sectionLectures.length;
    });

    return (
        <Card className="h-full shadow-lg">
            <CardContent className="p-2 h-full">
                <div className="p-2 mb-2">
                    <h2 className="font-bold">Programme du cours</h2>
                    <p className="text-xs text-muted-foreground">{completedLessons.length} / {totalLessons} leçons terminées</p>
                </div>
                 <Accordion type="multiple" defaultValue={sections?.map(s => s.id)} className="w-full">
                    {sections?.map(section => (
                        <AccordionItem value={section.id} key={section.id}>
                            <AccordionTrigger className="px-3 text-sm font-semibold hover:no-underline">{section.title}</AccordionTrigger>
                            <AccordionContent className="p-1 space-y-1">
                                {(allLectures.get(section.id) || []).map(lesson => {
                                    const isLocked = !isEnrolled && !lesson.isFreePreview;
                                    const isActive = activeLesson?.id === lesson.id;
                                    const isCompleted = completedLessons.includes(lesson.id);

                                    return (
                                        <button
                                            key={lesson.id}
                                            disabled={isLocked}
                                            onClick={() => onLessonClick(lesson)}
                                            className={cn(
                                                "w-full text-left flex items-center gap-2 p-2 rounded-md text-xs transition-colors",
                                                isActive ? "bg-primary/10 text-primary font-semibold" : "hover:bg-slate-100",
                                                isLocked && "text-slate-400 cursor-not-allowed",
                                                isCompleted && !isActive && "text-slate-500"
                                            )}
                                        >
                                            {isCompleted ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" /> : (isLocked ? <Lock className="h-3 w-3 shrink-0" /> : <PlayCircle className="h-3 w-3 shrink-0" />)}
                                            <span className="flex-1 line-clamp-1">{lesson.title}</span>
                                            {lesson.isFreePreview && <Badge variant="secondary" className="text-xs">Aperçu</Badge>}
                                        </button>
                                    );
                                })}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                 </Accordion>
            </CardContent>
        </Card>
    );
};

const CourseContentTabs = ({ courseId }: { courseId: string }) => {
    const db = getFirestore();
    const resourcesQuery = useMemoFirebase(() => query(collection(db, 'resources'), where('courseId', '==', courseId)), [courseId, db]);
    const {data: resources, isLoading} = useCollection(resourcesQuery);

    return (
        <Tabs defaultValue="overview">
            <TabsList>
                <TabsTrigger value="overview">Aperçu</TabsTrigger>
                <TabsTrigger value="qa">Q&R</TabsTrigger>
                <TabsTrigger value="resources">Ressources</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 prose prose-sm max-w-none">
                <p>Bienvenue dans cette leçon. Suivez attentivement la vidéo pour comprendre les concepts clés abordés par l'instructeur.</p>
                <p>N'oubliez pas de consulter l'onglet "Ressources" pour tout matériel supplémentaire et de poser vos questions dans l'onglet "Q&R" si vous êtes bloqué.</p>
            </TabsContent>
            <TabsContent value="qa" className="mt-4">
                <p>Section Questions/Réponses ici...</p>
            </TabsContent>
            <TabsContent value="resources" className="mt-4">
                 {isLoading ? <Skeleton className="h-20 w-full"/> : (
                    resources && resources.length > 0 ? (
                        <ul className="space-y-2">
                            {resources.map((res: any) => (
                                <li key={res.id}>
                                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg hover:bg-slate-100 border">
                                        <FileText className="h-4 w-4 text-primary" />
                                        <span className="text-sm font-medium">{res.title}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-muted-foreground p-4 border-dashed border rounded-lg text-center">Aucune ressource pour ce cours.</p>
                 )}
            </TabsContent>
        </Tabs>
    )
}

export default function CoursePlayerPage() {
    const { courseId } = useParams();
    const router = useRouter();
    const db = getFirestore();
    const { user, isUserLoading } = useRole();
    const { toast } = useToast();

    const [activeLesson, setActiveLesson] = useState<Lecture | null>(null);
    const [allLectures, setAllLectures] = useState<Map<string, Lecture[]>>(new Map());
    const [lecturesLoading, setLecturesLoading] = useState(true);

    const courseRef = useMemoFirebase(() => doc(db, 'courses', courseId as string), [db, courseId]);
    const { data: course, isLoading: courseLoading } = useDoc<Course>(courseRef);

    const sectionsQuery = useMemoFirebase(() => query(collection(db, 'courses', courseId as string, 'sections'), orderBy('order')), [db, courseId]);
    const { data: sections, isLoading: sectionsLoading } = useCollection<Section>(sectionsQuery);
    
    const enrollmentQuery = useMemoFirebase(() => {
        if (!user || !courseId) return null;
        return query(collection(db, 'enrollments'), where('studentId', '==', user.uid), where('courseId', '==', courseId as string));
    }, [db, user, courseId]);
    
    const { data: enrollments, isLoading: enrollmentLoading } = useCollection<Enrollment>(enrollmentQuery);
    const enrollment = useMemo(() => enrollments?.[0], [enrollments]);
    const isEnrolled = !!enrollment;
    const completedLessons = useMemo(() => enrollment?.completedLessons || [], [enrollment]);

    useEffect(() => {
        if (!sections || sections.length === 0) {
             if(!sectionsLoading) setLecturesLoading(false);
             return;
        }

        setLecturesLoading(true);
        const promises = sections.map(section => {
            const lecturesQuery = query(collection(db, `courses/${courseId}/sections/${section.id}/lectures`), orderBy('title'));
            return getDocs(lecturesQuery);
        });

        Promise.all(promises).then(snapshots => {
            const lecturesMap = new Map<string, Lecture[]>();
            snapshots.forEach((snapshot, index) => {
                const sectionId = sections[index].id;
                const sectionLectures = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lecture));
                lecturesMap.set(sectionId, sectionLectures);
            });
            setAllLectures(lecturesMap);
            setLecturesLoading(false);
        });

    }, [sections, sectionsLoading, courseId, db]);

    const isLoading = courseLoading || isUserLoading || enrollmentLoading || lecturesLoading;

    // Redirect if not enrolled
    useEffect(() => {
        if (!isLoading && !isEnrolled) {
            toast({
                title: "Accès refusé",
                description: "Vous devez être inscrit à ce cours.",
                variant: "destructive"
            });
            router.push(`/course/${courseId}`);
        }
    }, [isLoading, isEnrolled, courseId, router, toast]);

    const handleLessonCompletion = async () => {
        if (!enrollment || !activeLesson) return;
    
        if (completedLessons.includes(activeLesson.id)) {
            // No toast needed if already complete, just proceed to next lesson
            handleNextLesson();
            return;
        }

        const totalLessons = Array.from(allLectures.values()).reduce((acc, val) => acc + val.length, 0);
        const updatedCompletedLessons = [...completedLessons, activeLesson.id];
    
        const newProgress = totalLessons > 0 ? Math.round((updatedCompletedLessons.length / totalLessons) * 100) : 0;
        const enrollmentRef = doc(db, 'enrollments', enrollment.id);
        
        await updateDoc(enrollmentRef, {
            completedLessons: updatedCompletedLessons,
            progress: newProgress,
            lastWatchedLesson: activeLesson.id,
        });

        toast({
            title: "Leçon terminée !",
            description: `Votre progression est maintenant de ${newProgress}%.`,
        });
        
        handleNextLesson();
    };

    const handleNextLesson = () => {
        if (!activeLesson || !sections) return;

        let foundCurrent = false;
        for (const section of sections) {
            const lectures = allLectures.get(section.id) || [];
            for (const lesson of lectures) {
                if (foundCurrent) {
                    setActiveLesson(lesson);
                    return; // Next lesson found and set
                }
                if (lesson.id === activeLesson.id) {
                    foundCurrent = true;
                }
            }
        }
        // If loop finishes, it was the last lesson
        toast({ title: "Félicitations!", description: "Vous avez terminé la dernière leçon de ce cours." });
    };

    if (isLoading) {
        return (
             <div className="flex flex-col lg:flex-row h-screen bg-slate-50">
                <main className="flex-1 p-4 lg:p-6"><Skeleton className="aspect-video w-full rounded-lg" /></main>
                <aside className="hidden lg:block w-96 border-l p-4"><Skeleton className="h-full w-full" /></aside>
            </div>
        );
    }
    
    if (!course) {
        return <div className="p-8 text-center">Cours non trouvé.</div>
    }

    if (!isEnrolled) {
        // This is a fallback while redirecting
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const isEbook = course.contentType === 'ebook';

    return (
        <div className="flex flex-col lg:flex-row h-screen bg-slate-50 -m-6">
            <main className="flex-1 flex flex-col p-4 lg:p-6 space-y-6">
                <div className="flex items-center justify-between">
                     <Button variant="ghost" onClick={() => router.push(`/course/${courseId}`)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Retour aux détails du cours
                    </Button>
                </div>
                 {isEbook ? (
                    <div className="flex-1 w-full bg-slate-900 rounded-lg overflow-hidden">
                       <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`}>
                           {course.ebookUrl ? (
                                <Viewer fileUrl={course.ebookUrl} />
                           ) : (
                                <div className="flex items-center justify-center h-full text-white">Ce livre n'est pas disponible.</div>
                           )}
                       </Worker>
                    </div>
                ) : (
                     <VideoPlayer videoUrl={activeLesson?.videoUrl} onEnded={handleLessonCompletion} />
                )}
                <div className="mt-4">
                     <h1 className="text-xl lg:text-2xl font-bold">{isEbook ? course.title : activeLesson?.title || course.title}</h1>
                    {activeLesson && !isEbook ? (
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-slate-500 text-sm">Leçon actuelle</p>
                            <Button onClick={handleLessonCompletion} size="sm" disabled={completedLessons.includes(activeLesson.id)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {completedLessons.includes(activeLesson.id) ? 'Terminée' : 'Marquer comme terminée'}
                            </Button>
                        </div>
                    ) : <p className="text-slate-500 text-sm">{isEbook ? 'Livre Électronique' : 'Bienvenue dans votre cours'}</p>}
                </div>
                {!isEbook && (
                    <div className="mt-6 flex-grow bg-white p-6 rounded-2xl shadow-inner">
                      <CourseContentTabs courseId={courseId as string}/>
                    </div>
                )}
            </main>
            {!isEbook && (
                <aside className="w-full lg:w-96 lg:h-screen border-t lg:border-t-0 lg:border-l shrink-0 bg-white">
                    <div className="p-4 h-full overflow-y-auto">
                       <CourseSidebar 
                            courseId={courseId as string} 
                            activeLesson={activeLesson} 
                            onLessonClick={setActiveLesson} 
                            isEnrolled={isEnrolled}
                            completedLessons={completedLessons}
                            allLectures={allLectures}
                        />
                    </div>
                </aside>
            )}
        </div>
    );
}
