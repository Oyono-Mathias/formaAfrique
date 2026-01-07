
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRole } from '@/context/RoleContext';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { StudentSidebar } from './student-sidebar';
import { InstructorSidebar } from './instructor-sidebar';
import { AdminSidebar } from './admin-sidebar';
import { Footer } from './footer';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ShieldAlert, Bell, PanelLeft, Star, Search, Play, Heart, User, X, Megaphone } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sendEmailVerification } from 'firebase/auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { collection, query, where, onSnapshot, getFirestore, writeBatch, doc, getDoc } from 'firebase/firestore';

const pageTitles: { [key: string]: string } = {
    '/dashboard': 'Sélection',
    '/tutor': 'Tuteur IA',
    '/mes-formations': 'Mon apprentissage',
    '/mes-certificats': 'Mes Certificats',
    '/mes-devoirs': 'Mes Devoirs',
    '/questions-reponses': 'Questions & Réponses',
    '/messages': 'Messagerie',
    '/annuaire': 'Annuaire',
    '/profil': 'Profil',
    '/account': 'Mon Compte',
    '/liste-de-souhaits': 'Liste de souhaits',
    '/paiements': 'Paiements',
    '/notifications': 'Notifications',
    '/instructor/courses': 'Mes Cours',
    '/instructor/courses/create': 'Créer un cours',
    '/instructor/students': 'Mes Étudiants',
    '/mes-revenus': 'Mes Revenus',
    '/statistiques': 'Statistiques',
    '/avis': 'Avis',
    '/instructor/devoirs': 'Devoirs',
    '/quiz': 'Quiz',
    '/certificats-instructor': 'Certificats',
    '/ressources': 'Ressources',
    '/mentions-legales': 'Mentions Légales',
    '/cgu': 'Conditions Générales d\'Utilisation',
    '/admin/dashboard': 'Admin: Tableau de bord',
    '/admin/users': 'Admin: Gestion des utilisateurs',
    '/admin/courses': 'Admin: Gestion des cours',
    '/admin/payments': 'Admin: Finances',
    '/admin/moderation': 'Admin: Modération',
    '/admin/conversations': 'Admin: Conversations',
    '/admin/statistiques': 'Admin: Statistiques',
    '/admin/support': 'Admin: Support',
    '/admin/mon-profil': 'Admin: Mon Profil',
    '/admin/formations/disponibles': 'Admin: Formations disponibles',
    '/admin/formations/details': 'Admin: Détails des formations',
    '/admin/finances/paiements': 'Admin: Paiements',
    '/admin/finances/factures': 'Admin: Factures',
    '/admin/parametres/generaux': 'Admin: Paramètres généraux',
    '/admin/parametres/avances': 'Admin: Paramètres avancés',
};

function getPageTitle(pathname: string): string {
    if (pathname.startsWith('/course/')) return 'Détails du cours';
    if (pathname.startsWith('/courses/')) return 'Lecteur de cours';
    if (pathname.startsWith('/instructor/courses/edit')) return 'Éditeur de cours';
    if (pathname.startsWith('/instructor/courses/create')) return 'Créer un cours';
    if (pathname.startsWith('/messages/')) return 'Messagerie';
    if (pathname.startsWith('/questions-reponses/')) return 'Questions & Réponses';
    if (pathname.startsWith('/admin/users/')) return 'Profil Utilisateur';
    return pageTitles[pathname] || 'FormaAfrique';
}

function ApprovalPendingScreen() {
    return (
        <div className="flex items-center justify-center h-full p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle>Compte en attente d'approbation</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Votre compte instructeur est en cours de révision par notre équipe. Vous recevrez une notification par e-mail une fois qu'il sera approuvé.</p>
                    <p className="mt-4 text-sm text-muted-foreground">En attendant, vous pouvez utiliser le mode étudiant.</p>
                </CardContent>
            </Card>
        </div>
    )
}

function AdminAccessRequiredScreen() {
    const router = useRouter();
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
             <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
            <h1 className="text-2xl font-bold">Accès Interdit</h1>
            <p className="text-muted-foreground">Vous n'avez pas les autorisations nécessaires pour accéder à cette page.</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-6">
                Retour au tableau de bord
            </Button>
        </div>
    )
}

const BottomNavItem = ({ href, icon: Icon, label, isActive }: { href: string; icon: React.ElementType; label: string; isActive: boolean; }) => (
    <Link href={href} className="flex flex-col items-center justify-center flex-1 gap-1 p-1">
        <Icon className={cn("h-5 w-5", isActive ? 'text-primary' : 'text-slate-500')} strokeWidth={isActive ? 2.5 : 2} />
        <span className={cn("text-xs", isActive ? 'font-bold text-primary' : 'text-slate-600')}>{label}</span>
    </Link>
);


const BottomNavBar = () => {
    const pathname = usePathname();
    const items = [
        { href: '/dashboard', icon: Star, label: 'Sélection' },
        { href: '/search', icon: Search, label: 'Recherche' },
        { href: '/mes-formations', icon: Play, label: 'Apprentissage' },
        { href: '/liste-de-souhaits', icon: Heart, label: 'Souhaits' },
        { href: '/account', icon: User, label: 'Compte' },
    ];
    return (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-sm border-t border-slate-200/80 flex md:hidden z-40">
            {items.map(item => (
                <BottomNavItem key={item.href} {...item} isActive={pathname === item.href} />
            ))}
        </div>
    );
};

const useUnreadNotifications = (userId?: string) => {
    const [hasUnread, setHasUnread] = useState(false);
    const db = getFirestore();

    useEffect(() => {
        if (!userId) {
            setHasUnread(false);
            return;
        }

        const q = query(collection(db, `users/${userId}/notifications`), where('read', '==', false));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHasUnread(!snapshot.empty);
        }, (error) => {
            console.error("Failed to listen for unread notifications:", error);
            setHasUnread(false);
        });

        return () => unsubscribe();
    }, [userId, db]);

    return hasUnread;
};

const AnnouncementBanner = () => {
    const [message, setMessage] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const db = getFirestore();

    useEffect(() => {
        const settingsRef = doc(db, 'settings', 'global');
        const fetchSettings = async () => {
            const docSnap = await getDoc(settingsRef);
            if (docSnap.exists()) {
                const announcementMessage = docSnap.data().platform?.announcementMessage;
                if (announcementMessage) {
                    const dismissed = sessionStorage.getItem(`announcement_${announcementMessage}`);
                    if (!dismissed) {
                        setMessage(announcementMessage);
                        setIsVisible(true);
                    }
                }
            }
        };
        fetchSettings();
    }, [db]);
    
    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem(`announcement_${message}`, 'true');
    };

    if (!isVisible || !message) {
        return null;
    }

    return (
        <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center gap-4 text-sm font-medium relative overflow-hidden">
            <Megaphone className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
                <span className="inline-block animate-marquee-fast pr-8 whitespace-nowrap">{message}</span>
                <span className="inline-block animate-marquee-fast pr-8 whitespace-nowrap">{message}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleDismiss} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-primary/50">
                <X className="h-4 w-4"/>
            </Button>
        </div>
    );
};


export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, loading: isRoleLoading, user, isUserLoading, formaAfriqueUser, switchRole } = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const isAuthPage = pathname === '/' || pathname === '/register';
  const hasUnreadNotifications = useUnreadNotifications(user?.uid);
  
  React.useEffect(() => {
    if (!isAuthPage && !isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router, isAuthPage]);
  
  const isAdminRoute = pathname.startsWith('/admin');
  
  React.useEffect(() => {
    if (isAdminRoute && !isRoleLoading && formaAfriqueUser?.role === 'admin' && role !== 'admin') {
      switchRole('admin');
    }
  }, [pathname, isRoleLoading, formaAfriqueUser, role, switchRole, isAdminRoute]);


  if (isAuthPage) {
    return <>{children}</>;
  }


  const handleResendVerification = async () => {
    if (user) {
      setIsSendingVerification(true);
      try {
        await sendEmailVerification(user);
        toast({ title: "E-mail renvoyé !", description: "Veuillez vérifier votre boîte de réception." });
      } catch (error) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de renvoyer l'e-mail de vérification." });
      } finally {
        setIsSendingVerification(false);
      }
    }
  };

  const renderSidebar = () => {
    switch (role) {
      case 'student':
        return <StudentSidebar />;
      case 'instructor':
        return <InstructorSidebar />;
      case 'admin':
        return <AdminSidebar />;
      default:
        return <StudentSidebar />;
    }
  };
  
  if (isUserLoading || isRoleLoading) {
    return (
      <div className="flex min-h-screen w-full bg-background dark:bg-[#0f172a]">
        <div className="hidden md:flex flex-col gap-4 border-r bg-white dark:bg-[#1e293b] dark:border-slate-700 p-4 w-64">
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="space-y-2 mt-4 px-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        </div>
        <main className="flex-1">
           <header className="flex h-14 items-center gap-4 border-b bg-card dark:bg-[#1e293b] dark:border-slate-700 px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30">
             <Skeleton className="h-8 w-8 md:hidden" />
             <Skeleton className="h-8 w-48" />
           </header>
           <div className="p-4 sm:p-6 space-y-6">
             <Skeleton className="h-32 w-full" />
             <Skeleton className="h-64 w-full" />
           </div>
        </main>
      </div>
    );
  }
  
  if (!user) {
    return null;
  }
  
  const isStudioRoute = pathname.startsWith('/instructor/courses/edit/');
  if (isStudioRoute) {
    return <>{children}</>;
  }

  const isInstructorAndNotApproved = role === 'instructor' && formaAfriqueUser && !formaAfriqueUser.isInstructorApproved;
  const userIsNotAdmin = formaAfriqueUser?.role !== 'admin';
  const showAdminAccessRequired = isAdminRoute && userIsNotAdmin;
  const isFullScreenPage = pathname.startsWith('/courses/') || pathname.startsWith('/messages/') || pathname.startsWith('/questions-reponses/') || pathname.startsWith('/course/');
  const showBottomNav = (role === 'student') && isMobile;

  return (
    <div className='dark flex flex-col min-h-screen bg-background-alt dark:bg-[#0f172a]'>
        <div className="flex flex-1">
            <aside className={cn("hidden md:flex", isFullScreenPage && "md:hidden")}>
              {renderSidebar()}
            </aside>
            <div className="flex flex-col flex-1">
              <header className="flex h-14 items-center gap-4 border-b bg-card dark:bg-[#1e293b] dark:border-slate-700 px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className={cn("shrink-0 md:hidden", isFullScreenPage && "hidden")}>
                        <PanelLeft className="text-foreground"/>
                        <span className="sr-only">Toggle Menu</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-64 dark:bg-[#1e293b] border-r-0">
                       <SheetHeader>
                        <SheetTitle className="sr-only">Menu principal</SheetTitle>
                        <SheetDescription className="sr-only">Navigation pour le profil utilisateur.</SheetDescription>
                      </SheetHeader>
                      {renderSidebar()}
                    </SheetContent>
                  </Sheet>
                  <div className="flex-1">
                      <h1 className="text-lg font-semibold md:text-xl text-card-foreground dark:text-white">
                          {isInstructorAndNotApproved ? "Approbation en attente" : getPageTitle(pathname)}
                      </h1>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => router.push('/notifications')} className="text-card-foreground dark:text-white relative">
                      <Bell className="h-4 w-4" />
                       {hasUnreadNotifications && (
                          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                          </span>
                       )}
                      <span className="sr-only">Notifications</span>
                  </Button>
              </header>
              <AnnouncementBanner />
              <main className={cn("flex-1 overflow-y-auto w-full", !isFullScreenPage && "p-4 sm:p-6", showBottomNav ? "pb-20" : "")}>
                  <div className={cn(!isFullScreenPage && "w-full")}>
                    {!isUserLoading && user && !user.emailVerified && !isFullScreenPage && (
                      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-md" role="alert">
                        <p className="font-bold">Vérifiez votre adresse e-mail</p>
                        <p className="text-sm">
                          Un lien de vérification a été envoyé à votre adresse. Veuillez vérifier votre boîte de réception.
                        </p>
                        <Button
                          variant="link"
                          className="p-0 h-auto text-yellow-800 font-bold text-sm"
                          onClick={handleResendVerification}
                          disabled={isSendingVerification}
                        >
                          {isSendingVerification ? 'Envoi en cours...' : 'Renvoyer l\'e-mail'}
                        </Button>
                      </div>
                    )}
                    {showAdminAccessRequired ? <AdminAccessRequiredScreen /> : (isInstructorAndNotApproved ? <ApprovalPendingScreen /> : children)}
                  </div>
              </main>
              {showBottomNav && <BottomNavBar />}
              {!isFullScreenPage && !showBottomNav && <Footer />}
            </div>
        </div>
    </div>
  );
}
