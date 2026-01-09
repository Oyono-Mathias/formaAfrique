
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useRole } from '@/context/RoleContext';
import { doc, getFirestore, collection, serverTimestamp, query, where, getDocs, setDoc, updateDoc, addDoc, orderBy, DocumentData, QuerySnapshot, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreditCard, Info, BookOpen, Gift, Loader2, Check, Star, AlertTriangle, MessageSquarePlus, MessageSquare, Video, PlayCircle, Lock, ChevronRight, ChevronDown, ChevronUp, Book } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Review, Section, Lecture, Course } from '@/lib/types';
import type { FormaAfriqueUser } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ReviewForm } from '@/components/reviews/review-form';
import { Textarea } from '@/components/ui/textarea';
import dynamic from 'next/dynamic';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { sendEnrollmentEmails } from '@/lib/emails';

const ReactPlayer = dynamic(() => import('react-player/lazy'), { ssr: false });

interface ReviewWithUser extends Review {
  reviewerName?: string;
  reviewerImage?: string;
}

const StarRating = ({ rating, size = 'md' }: { rating: number, size?: 'sm' | 'md' | 'lg' }) => {
  const starSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };
  return (
    <div className="flex items-center">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={cn(
            starSizeClasses[size],
            i < Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
          )}
        />
      ))}
    </div>
  );
};

const CourseCurriculum = ({ courseId, isEnrolled, onLessonClick, activeLessonId }: { courseId: string, isEnrolled: boolean, onLessonClick: (lesson: Lecture) => void, activeLessonId: string | null }) => {
    const db = getFirestore();
    const sectionsQuery = useMemoFirebase(() => query(collection(db, 'courses', courseId, 'sections'), orderBy('order')), [db, courseId]);
    const { data: sections, isLoading: sectionsLoading } = useCollection<Section>(sectionsQuery);
    
    const [lecturesMap, setLecturesMap] = useState<Map<string, Lecture[]>>(new Map());
    const [lecturesLoading, setLecturesLoading] = useState(true);
    const [openSectionId, setOpenSectionId] = useState<string | null>(null);

    useEffect(() => {
        if (sections && sections.length > 0 && !openSectionId) {
            setOpenSectionId(sections[0].id);
        }
    }, [sections, openSectionId]);

    useEffect(() => {
        if (!sections || sectionsLoading) {
            if (!sectionsLoading) setLecturesLoading(false);
            return;
        }

        setLecturesLoading(true);
        const allLecturesPromises: Promise<QuerySnapshot<DocumentData>>[] = [];
        sections.forEach(section => {
          const lecturesQuery = query(collection(db, 'courses', courseId, 'sections', section.id, 'lectures'), orderBy('title'));
          allLecturesPromises.push(getDocs(lecturesQuery));
        });

        Promise.all(allLecturesPromises).then(lectureSnapshots => {
            const newLecturesMap = new Map<string, Lecture[]>();
            let firstLesson: Lecture | null = null;
            lectureSnapshots.forEach((snapshot, index) => {
                const sectionId = sections[index].id;
                const lectures = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lecture));
                if (!firstLesson && lectures.length > 0 && (lectures[0].isFreePreview || isEnrolled)) {
                    firstLesson = lectures[0];
                }
                newLecturesMap.set(sectionId, lectures);
            });
            setLecturesMap(newLecturesMap);
            setLecturesLoading(false);
            if (firstLesson) {
                onLessonClick(firstLesson);
            }
        }).catch(err => {
            console.error("Error fetching lectures:", err);
            setLecturesLoading(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sections, sectionsLoading, db, courseId]);
    
    const handleToggleSection = (sectionId: string) => {
        setOpenSectionId(prevId => (prevId === sectionId ? null : sectionId));
    };


    if (sectionsLoading) {
        return <Skeleton className="h-48 w-full" />;
    }

    if (!sections || sections.length === 0) {
        return (
            <div className="border rounded-lg p-6 text-center text-muted-foreground">
                <p>Le programme de ce cours n'est pas encore disponible.</p>
            </div>
        );
    }
    
    return (
        <div className="w-full space-y-2">
            {sections.map((section) => {
                const isOpen = openSectionId === section.id;
                return (
                    <div key={section.id} className="bg-slate-50 dark:bg-[#1e293b] rounded-2xl border dark:border-slate-700 overflow-hidden">
                        <button
                            onClick={() => handleToggleSection(section.id)}
                            className="w-full flex justify-between items-center px-6 py-4 text-left font-semibold text-lg text-slate-800 dark:text-white"
                        >
                            <h2>{section.title}</h2>
                            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        {isOpen && (
                            <div className="px-6 pb-4 bg-slate-100 dark:bg-slate-900/50">
                                {lecturesLoading ? <Skeleton className="h-10 w-full" /> : (
                                    <ul className="space-y-1 pt-4">
                                        {(lecturesMap.get(section.id) || []).map(lecture => {
                                            const canPreview = lecture.isFreePreview || isEnrolled;
                                            const isActive = lecture.id === activeLessonId;
                                            return (
                                                <li key={lecture.id}>
                                                  <button onClick={() => canPreview && onLessonClick(lecture)} disabled={!canPreview} className={cn("w-full text-left flex justify-between items-center text-sm p-2 rounded-md transition-colors", 
                                                    isActive && "bg-primary/10 text-primary font-bold",
                                                    canPreview && "hover:bg-slate-200 dark:hover:bg-slate-700/50",
                                                    !canPreview && "cursor-not-allowed text-muted-foreground"
                                                  )}>
                                                      <div className="flex items-center">
                                                          {canPreview ? <PlayCircle className="h-4 w-4 mr-2 text-primary" /> : <Lock className="h-4 w-4 mr-2 text-muted-foreground" />}
                                                          <span className="dark:text-slate-300">{lecture.title}</span>
                                                          {lecture.isFreePreview && !isEnrolled && <Badge variant="secondary" className="ml-2">Aperçu</Badge>}
                                                      </div>
                                                      <span className="text-xs text-muted-foreground">{lecture.duration ? `${lecture.duration} min` : ''}</span>
                                                  </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};


const ReviewsSection = ({ courseId, isEnrolled }: { courseId: string, isEnrolled: boolean }) => {
  const db = getFirestore();
  const { user, isUserLoading } = useRole();
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewsWithUsers, setReviewsWithUsers] = useState<ReviewWithUser[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const reviewsQuery = useMemoFirebase(() => query(collection(db, 'reviews'), where('courseId', '==', courseId)), [db, courseId]);
  const { data: reviews, isLoading: rawReviewsLoading } = useCollection<Review>(reviewsQuery);
  
  useEffect(() => {
    if (user && reviews) {
      const userReview = reviews.find(r => r.userId === user.uid);
      setHasReviewed(!!userReview);
    }
  }, [user, reviews]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!reviews || reviews.length === 0) {
        setReviewsWithUsers([]);
        setReviewsLoading(false);
        return;
      }
      
      setReviewsLoading(true);
      const userIds = [...new Set(reviews.map(r => r.userId))];
      if (userIds.length === 0) {
          setReviewsWithUsers([]);
          setReviewsLoading(false);
          return;
      }
      const usersRef = collection(db, 'users');
      // Firestore 'in' query has a limit of 30 items
      const usersQuery = query(usersRef, where('uid', 'in', userIds.slice(0, 30)));
      const userSnapshots = await getDocs(usersQuery);

      const usersById = new Map();
      userSnapshots.forEach(doc => usersById.set(doc.data().uid, doc.data()));

      const populatedReviews = reviews.map(review => {
        const user = usersById.get(review.userId);
        return {
          ...review,
          reviewerName: user?.fullName || 'Anonyme',
          reviewerImage: user?.profilePictureURL,
        };
      });

      setReviewsWithUsers(populatedReviews);
      setReviewsLoading(false);
    };

    if (!rawReviewsLoading) {
      fetchUsers();
    }
  }, [reviews, db, rawReviewsLoading]);

  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    const total = reviews.reduce((acc, review) => acc + review.rating, 0);
    return total / reviews.length;
  }, [reviews]);
  
  const isLoading = rawReviewsLoading || reviewsLoading || isUserLoading;

  return (
    <div className="space-y-8">
        <h2 className="text-2xl font-bold dark:text-white">Avis des étudiants</h2>
        {isLoading ? (
            <Skeleton className="h-48 w-full" />
        ) : reviewsWithUsers.length > 0 ? (
            <div className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-yellow-500">{averageRating.toFixed(1)}</span>
                    <StarRating rating={averageRating} />
                    <span className="text-muted-foreground text-sm">({reviews?.length || 0} avis)</span>
                </div>
                {reviewsWithUsers?.slice(0, 5).map(review => (
                    <div key={review.id} className="flex gap-4 border-t dark:border-slate-700 pt-4">
                        <Avatar>
                            <AvatarImage src={review.reviewerImage} />
                            <AvatarFallback>{review.reviewerName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold dark:text-white">{review.reviewerName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <StarRating rating={review.rating} size="sm" />
                                <span>{review.createdAt ? format(review.createdAt.toDate(), 'dd MMM yyyy', { locale: fr }) : ''}</span>
                            </div>
                            <p className="text-sm dark:text-slate-300">{review.comment}</p>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="border dark:border-slate-700 rounded-2xl p-6 text-center text-muted-foreground">
                <p>Aucun avis pour ce cours pour le moment.</p>
            </div>
        )}

        {user && !hasReviewed && isEnrolled && (
          <div className="pt-8">
             <h3 className="text-xl font-bold mb-4 dark:text-white">Laissez votre avis</h3>
             <ReviewForm courseId={courseId} userId={user.uid} onReviewSubmit={() => setHasReviewed(true)} />
          </div>
        )}
    </div>
  );
};


const QASection = ({ courseId, instructorId }: { courseId: string, instructorId: string }) => {
  const db = getFirestore();
  const { user } = useRole();
  const { toast } = useToast();
  const [newQuestion, setNewQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ticketsQuery = useMemoFirebase(
    () => query(collection(db, 'support_tickets'), where('courseId', '==', courseId), orderBy('createdAt', 'desc')),
    [db, courseId]
  );
  const { data: tickets, isLoading: ticketsLoading } = useCollection(ticketsQuery);
  
  const handleAskQuestion = async () => {
    if (!newQuestion.trim() || !user ) return;
    setIsSubmitting(true);
    
    const ticketPayload = {
      userId: user.uid,
      instructorId: instructorId,
      courseId: courseId,
      subject: newQuestion.trim(),
      lastMessage: newQuestion.trim(),
      status: 'open' as 'open' | 'closed',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    try {
      await addDoc(collection(db, 'support_tickets'), ticketPayload);
      toast({ title: "Question envoyée !", description: "Votre question a été envoyée à l'instructeur."});
      setNewQuestion("");
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'support_tickets', operation: 'create', requestResourceData: ticketPayload }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold dark:text-white">Questions à l'instructeur</h2>

      <div className="space-y-4">
        <Textarea 
          placeholder="Posez votre question ici..."
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          rows={3}
        />
        <Button onClick={handleAskQuestion} disabled={!newQuestion.trim() || isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquarePlus className="mr-2 h-4 w-4" />}
          Poser ma question
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold dark:text-white">Questions récentes</h3>
        {ticketsLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : tickets && tickets.length > 0 ? (
          <div className="space-y-3">
            {tickets.map((ticket: any) => (
              <Link key={ticket.id} href={`/questions-reponses/${ticket.id}`} className="block p-4 border dark:border-slate-700 rounded-2xl hover:bg-muted/50 dark:hover:bg-slate-800/50">
                  <p className="font-semibold dark:text-white">{ticket.subject}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Dernière activité il y a {ticket.updatedAt ? formatDistanceToNow(ticket.updatedAt.toDate(), { locale: fr }) : 'un moment'}
                  </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-6 border-dashed border dark:border-slate-700 rounded-2xl text-center text-muted-foreground">
            <MessageSquare className="mx-auto h-8 w-8 mb-2"/>
            <p>Personne n'a encore posé de question pour ce cours. Soyez le premier !</p>
          </div>
        )}
      </div>
    </div>
  )
};


export default function CourseDetailsClient() {
  const { courseId: courseIdParam } = useParams();
  const courseId = courseIdParam as string;
  const db = getFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, formaAfriqueUser, isUserLoading } = useRole();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [courseStats, setCourseStats] = useState({ totalDuration: 0, lessonCount: 0 });
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lecture | null>(null);

  const courseRef = useMemoFirebase(() => courseId ? doc(db, 'courses', courseId) : null, [db, courseId]);
  const { data: course, isLoading: courseLoading } = useDoc<Course>(courseRef);

  const instructorRef = useMemoFirebase(() => course?.instructorId ? doc(db, 'users', course.instructorId) : null, [db, course]);
  const { data: instructor, isLoading: instructorLoading } = useDoc<FormaAfriqueUser>(instructorRef);

  const enrollmentQuery = useMemoFirebase(() => {
    if (!user || !courseId) return null;
    return query(collection(db, 'enrollments'), where('studentId', '==', user.uid), where('courseId', '==', courseId));
  }, [db, user, courseId]);

  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection(enrollmentQuery);
  const isEnrolled = useMemo(() => (enrollments?.length ?? 0) > 0, [enrollments]);

  useEffect(() => {
    if (!courseId || course?.contentType === 'ebook') return;

    const fetchStats = async () => {
        const sectionsQuery = query(collection(db, 'courses', courseId, 'sections'));
        const sectionsSnap = await getDocs(sectionsQuery);
        
        let totalDuration = 0;
        let lessonCount = 0;
        
        for (const sectionDoc of sectionsSnap.docs) {
            const lecturesQuery = query(collection(db, 'courses', courseId, 'sections', sectionDoc.id, 'lectures'));
            const lecturesSnap = await getDocs(lecturesQuery);
            lecturesSnap.forEach(lectureDoc => {
                const lectureData = lectureDoc.data();
                lessonCount++;
                totalDuration += Number(lectureData.duration) || 0;
            });
        }
        
        setCourseStats({ totalDuration, lessonCount });
    };

    fetchStats();
  }, [courseId, db, course?.contentType]);


  const handlePurchase = () => {
    toast({
        title: "Simulation de paiement",
        description: `Redirection pour l'achat du cours : ${course?.title}`,
    });
    router.push(`/paiements?courseId=${courseId}`);
  };

  const handleFreeEnrollment = async () => {
    if (!user || !course || !course.instructorId || !instructor || !formaAfriqueUser) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Vous devez être connecté et les détails du cours doivent être complets.' });
        if(!user) router.push('/');
        return;
    }

    setIsEnrolling(true);

    try {
        if(isEnrolled) {
            toast({ title: 'Déjà inscrit', description: 'Vous êtes déjà inscrit à ce cours.' });
            router.push(`/courses/${course.id}`);
            return;
        }

        const enrollmentId = `${user.uid}_${courseId}`;
        const enrollmentRef = doc(db, 'enrollments', enrollmentId);
        
        const enrollmentPayload = {
            enrollmentId: enrollmentId,
            studentId: user.uid,
            courseId: courseId,
            instructorId: course.instructorId,
            enrollmentDate: serverTimestamp(),
            progress: 0,
        };
        
        await setDoc(enrollmentRef, enrollmentPayload);

        toast({ title: 'Inscription réussie!', description: `Vous avez maintenant accès à "${course.title}".` });
        
        // Send email notifications
        await sendEnrollmentEmails(formaAfriqueUser, course, instructor);

        router.push(`/courses/${courseId}?newEnrollment=true`);

    } catch (error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `enrollments/${user.uid}_${courseId}`,
            operation: 'create',
            requestResourceData: { studentId: user.uid, courseId: courseId, progress: 0, instructorId: course.instructorId },
        }));
        setIsEnrolling(false);
    }
  };

  const isLoading = courseLoading || instructorLoading || enrollmentsLoading || isUserLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl py-8 px-4">
        <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-5/6" />
                <Skeleton className="h-64 w-full" />
            </div>
            <div className="space-y-4">
                 <Skeleton className="h-96 w-full rounded-3xl" />
            </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto max-w-7xl py-12 text-center">
        <Info className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Cours non trouvé</h1>
        <p className="text-muted-foreground">Le cours que vous cherchez n'existe pas ou a été retiré.</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-6">Retour au tableau de bord</Button>
      </div>
    );
  }
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description,
    provider: {
      '@type': 'Organization',
      name: 'FormaAfrique',
      url: 'https://formaafrique-app.web.app', // Replace with actual domain
    },
    offers: {
      '@type': 'Offer',
      price: course.price,
      priceCurrency: 'XOF',
      category: 'Paid',
    },
    aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.7',
        reviewCount: '123',
    },
  };

  const isFree = course.price === 0;
  const isEbook = course.contentType === 'ebook';

  const getButtonText = () => {
    if(isEnrolled) return isEbook ? "Lire l'E-book" : "Aller au cours";
    if(isFree) return isEbook ? "Obtenir l'E-book Gratuitement" : "S'inscrire Gratuitement";
    return isEbook ? "Acheter l'E-book" : "Acheter le Cours";
  }

  const handleMainAction = () => {
    if(isEnrolled) router.push(`/courses/${courseId}`);
    else if(isFree) handleFreeEnrollment();
    else handlePurchase();
  }
  
  const playerConfig = {
    youtube: {
        playerVars: { 
            origin: typeof window !== 'undefined' ? window.location.origin : 'https://formaafrique-app.web.app',
            autoplay: 0
        }
    },
     attributes: {
      playsInline: true,
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="bg-background-alt dark:bg-[#0f172a]">
        <div className="bg-slate-800 text-white py-12">
          <div className="container mx-auto max-w-7xl px-4 lg:px-8">
              <div className="text-sm mb-4">
                  <Link href="/dashboard" className="hover:text-slate-300">Accueil</Link>
                  <ChevronRight className="inline-block h-4 w-4 mx-1" />
                  <Link href="/search" className="hover:text-slate-300">Cours</Link>
              </div>
            <div className="grid lg:grid-cols-3 gap-8 items-center">
              <div className="lg:col-span-2 space-y-4">
                <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">{course.title}</h1>
                <div className="relative overflow-hidden">
                    <p className={cn("text-lg text-slate-300 leading-relaxed", !isDescriptionExpanded && "line-clamp-5")}>
                        {course.description}
                    </p>
                    {!isDescriptionExpanded && <div className="absolute bottom-0 h-12 w-full bg-gradient-to-t from-slate-800 to-transparent"></div>}
                </div>
                 <Button variant="link" onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} className="text-white p-0 h-auto">
                    {isDescriptionExpanded ? "Voir moins" : "Lire la suite"}
                    {isDescriptionExpanded ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
                </Button>
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20">{isEbook ? 'E-book' : course.category}</Badge>
                  <div className="flex items-center gap-2">
                    <StarRating rating={4.5} />
                    <span className="text-slate-400">(1,234 avis)</span>
                  </div>
                  <span>Créé par 
                      <Link href={`/instructor/${instructor?.id}`} className="font-bold underline hover:text-slate-200 ml-1">
                          {instructor?.fullName || 'Un instructeur FormaAfrique'}
                      </Link>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="container mx-auto max-w-7xl py-8 px-4 lg:px-8">
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
              <main className="lg:col-span-2 space-y-12">
                {!isEbook && (
                    <Card className="mb-8 rounded-3xl shadow-lg bg-slate-50 dark:bg-[#1e293b] dark:border-slate-700">
                    <CardHeader>
                        <CardTitle className="dark:text-white"><h2>Ce que vous apprendrez</h2></CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 list-inside text-slate-700 dark:text-slate-300">
                            {course.learningObjectives?.map((obj: string, i: number) => (
                                <li key={i} className="flex items-start"><Check className="w-5 h-5 mr-2 mt-1 text-primary flex-shrink-0" /><span>{obj}</span></li>
                            )) ||  <li className="flex items-start"><Check className="w-5 h-5 mr-2 mt-1 text-primary flex-shrink-0" /><span>Les fondamentaux de ce sujet.</span></li>}
                        </ul>
                    </CardContent>
                    </Card>
                )}

                <div className="space-y-6">
                  {isEbook ? <h2 className="text-2xl font-bold dark:text-white">Aperçu du livre</h2> : <h2 className="text-2xl font-bold dark:text-white">Programme du cours</h2>}
                  {!isEbook && <CourseCurriculum courseId={courseId} isEnrolled={isEnrolled} onLessonClick={setActiveLesson} activeLessonId={activeLesson?.id || null} />}

                  <h2 className="text-2xl font-bold dark:text-white">Prérequis</h2>
                   <ul className="list-disc list-inside space-y-1 dark:text-slate-300">
                      {course.prerequisites?.map((pre: string, i: number) => (
                         <li key={i}>{pre}</li>
                      )) || <li>Aucun prérequis !</li>}
                  </ul>
                </div>

                {isEnrolled && instructor && <QASection courseId={courseId} instructorId={instructor.id} />}

                {instructor && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4 dark:text-white">À propos de l'instructeur</h2>
                    <Link href={`/instructor/${instructor.id}`} className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-[#1e293b] rounded-3xl shadow-lg hover:shadow-2xl transition-shadow dark:border dark:border-slate-700">
                      <Avatar className="h-16 w-16">
                          <AvatarImage src={instructor.profilePictureURL} />
                          <AvatarFallback className="text-white">{instructor.fullName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                          <h3 className="font-bold text-lg hover:text-primary dark:text-white">{instructor.fullName}</h3>
                          <p className="text-sm text-muted-foreground">{instructor.careerGoals?.currentRole || `Expert en ${course.category}`}</p>
                          <p className="mt-2 text-sm line-clamp-2 dark:text-slate-300">{instructor.bio || 'Cet instructeur n\'a pas encore fourni de biographie.'}</p>
                      </div>
                    </Link>
                  </div>
                )}
                
                <ReviewsSection courseId={courseId} isEnrolled={isEnrolled} />

              </main>

              <aside className="hidden lg:block mt-8 lg:mt-0">
                  <div className="sticky top-24">
                    <Card className="shadow-xl rounded-3xl dark:bg-[#1e293b] dark:border-slate-700">
                         <div className="relative group aspect-video w-full bg-black rounded-t-3xl overflow-hidden min-h-[200px] z-10">
                           {activeLesson?.videoUrl ? (
                               <ReactPlayer
                                  key={activeLesson.videoUrl} 
                                  url={activeLesson.videoUrl} 
                                  width="100%" 
                                  height="100%" 
                                  playing={true} 
                                  controls={true} 
                                  config={playerConfig}
                                />
                           ) : (
                                <Image 
                                    src={course.imageUrl || `https://picsum.photos/seed/${course.id}/800/450`}
                                    alt={course.title}
                                    width={800}
                                    height={450}
                                    className="object-cover w-full h-full"
                                />
                           )}
                           {!isEnrolled && !isEbook && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                   <Button size="icon" variant="secondary" className="h-16 w-16 rounded-full tv:h-20 tv:w-20" onClick={handleMainAction}>
                                     <PlayCircle className="h-8 w-8 text-primary tv:h-10 tv:w-10"/>
                                   </Button>
                                </div>
                            )}
                        </div>
                        <CardContent className="p-6 space-y-4">
                            <h2 className="text-3xl tv:text-4xl font-bold text-center dark:text-white">
                                {isFree ? 'Gratuit' : `${course.price.toLocaleString('fr-FR')} XOF`}
                            </h2>

                            <Button className={cn("w-full tv:text-lg tv:h-14", isEnrolled && "bg-green-600 hover:bg-green-700")} size="lg" onClick={handleMainAction} disabled={isEnrolling}>
                                {isEnrolling ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 
                                 isEbook ? <BookOpen className="mr-2 h-5 w-5" /> : 
                                 isEnrolled ? <Check className="mr-2 h-5 w-5" /> :
                                 <CreditCard className="mr-2 h-5 w-5" />}
                                {isEnrolling ? 'Traitement...' : getButtonText()}
                            </Button>
                            
                            <p className="text-xs text-muted-foreground text-center">Garantie satisfait ou remboursé 30 jours</p>

                             <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="font-semibold dark:text-white">Ce produit inclut :</h3>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    {isEbook ? (
                                        <>
                                            <li className="flex items-center gap-2"><Book className="h-4 w-4 text-primary" /> Format PDF</li>
                                            <li className="flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> Accès immédiat après achat</li>
                                        </>
                                    ) : (
                                        <>
                                            <li className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> {(courseStats.totalDuration / 60).toFixed(1)} heures de vidéo à la demande</li>
                                            <li className="flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> {courseStats.lessonCount} leçons</li>
                                            <li className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Accès sur mobile et TV</li>
                                            <li className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> Accès complet à vie</li>
                                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Certificat de réussite</li>
                                        </>
                                    )}
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                  </div>
              </aside>
              
               {/* Sticky footer for mobile */}
              {!isEnrolled && (
                <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-4 border-t border-slate-200 dark:border-slate-700 z-50">
                    <div className="flex justify-between items-center">
                        <p className="font-bold text-xl dark:text-white">{isFree ? 'Gratuit' : `${course.price.toLocaleString('fr-FR')} XOF`}</p>
                        <Button className="w-auto" size="lg" onClick={handleMainAction} disabled={isEnrolling}>
                            {isEnrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {getButtonText()}
                        </Button>
                    </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </>
  );
}
