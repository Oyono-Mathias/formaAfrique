
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
import { ShieldAlert, Bell, PanelLeft, Star, Search, Play, Heart, User, X, Megaphone, MessageSquare, Tool, Loader2, HelpCircle, Mail } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sendEmailVerification } from 'firebase/auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { collection, query, where, onSnapshot, getFirestore, writeBatch, doc, getDoc } from 'firebase/firestore';
import { LanguageSelector } from './language-selector'; // Import the new component
import { useTranslation } from 'react-i18next';


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
    '/admin': 'Admin: Tableau de bord',
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

function MaintenancePage() {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-center p-4">
            <Tool className="h-16 w-16 text-primary mb-4" />
            <h1 className="text-3xl font-bold text-foreground">Site en maintenance</h1>
            <p className="text-muted-foreground mt-2">Nous effectuons des mises à jour. Le site sera de retour très prochainement.</p>
        </div>
    );
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

const BottomNavItem = ({ href, icon: Icon, label, isActive, unreadCount }: { href: string; icon: React.ElementType; label: string; isActive: boolean; unreadCount?: number }) => (
    <Link href={href} className="flex flex-col items-center justify-center flex-1 gap-1 p-1 relative">
        <Icon className={cn("h-5 w-5", isActive ? 'text-primary' : 'text-slate-500')} strokeWidth={isActive ? 2.5 : 2} />
        <span className={cn("text-xs", isActive ? 'font-bold text-primary' : 'text-slate-600')}>{label}</span>
        {unreadCount !== undefined && unreadCount > 0 && (
            <span className="absolute top-1 right-3.5 h-4 min-w-[1rem] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
        )}
    </Link>
);


const BottomNavBar = () => {
    const pathname = usePathname();
    const { user } = useRole();
    const [unreadMessages, setUnreadMessages] = useState(0);
    const db = getFirestore();

    useEffect(() => {
        if (!user?.uid) return;
        const q = query(collection(db, 'chats'), where('unreadBy', 'array-contains', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadMessages(snapshot.size);
        });
        return () => unsubscribe();
    }, [user, db]);

    const items = [
        { href: '/dashboard', icon: Star, label: 'Sélection' },
        { href: '/mes-formations', icon: Play, label: 'Apprentissage' },
        { href: '/messages', icon: MessageSquare, label: 'Messages', unreadCount: unreadMessages },
        { href: '/liste-de-souhaits', icon: Heart, label: 'Souhaits' },
        { href: '/account', icon: User, label: 'Compte' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-sm border-t border-slate-200/80 flex md:hidden z-40">
            {items.map(item => (
                <BottomNavItem key={item.href} {...item} isActive={pathname.startsWith(item.href)} />
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
    const { t } = useTranslation();
    const [message, setMessage] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const db = getFirestore();
    const pathname = usePathname();
    const isChatPage = pathname.startsWith('/messages/');

    useEffect(() => {
        const fetchSettings = async () => {
            const settingsRef = doc(db, 'settings', 'global');
            const docSnap = await getDoc(settingsRef);
            if (docSnap.exists()) {
                const announcementMessage = docSnap.data().platform?.announcementMessage;
                if (announcementMessage) {
                    const dismissed = sessionStorage.getItem(`announcement_${announcementMessage}`);
                    if (!dismissed) {
                        setMessage(announcementMessage);
                        setIsVisible(true);
                    }
                } else {
                  // Use translated launch offer as fallback
                  const launchOffer = t('launchOffer');
                   const dismissed = sessionStorage.getItem(`announcement_${launchOffer}`);
                   if (!dismissed) {
                       setMessage(launchOffer);
                       setIsVisible(true);
                   } else {
                        setIsVisible(false);
                   }
                }
            } else {
                const launchOffer = t('launchOffer');
                const dismissed = sessionStorage.getItem(`announcement_${launchOffer}`);
                if (!dismissed) {
                    setMessage(launchOffer);
                    setIsVisible(true);
                }
            }
        };
        fetchSettings();
    }, [db, pathname, t]);
    
    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem(`announcement_${message}`, 'true');
    };

    if (!isVisible || !message || isChatPage) {
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

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.04 2.01C6.58 2.01 2.13 6.46 2.13 12.02c0 1.76.46 3.45 1.32 4.94L2.05 22l5.3-1.4c1.42.82 3.02 1.28 4.69 1.28h.01c5.46 0 9.91-4.45 9.91-9.91s-4.45-9.9-9.91-9.9zM12.04 20.2c-1.45 0-2.84-.38-4.06-1.08l-.3-.18-3.03.8.82-2.96-.2-.32a8.03 8.03 0 01-1.23-4.45c0-4.43 3.6-8.03 8.03-8.03s8.03 3.6 8.03 8.03-3.6 8.02-8.03 8.02zm4.45-6.21c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-1.25-.87-1.57-1.6-1.61-1.72-.04-.12 0-.18.11-.3.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.42-.54-.42h-.47c-.16 0-.42.06-.64.3.22.24-.88.85-.88,2.07s.9,2.4,1.02,2.56c.12.16,1.78,2.73,4.31,3.8.59.25,1.05.4,1.41.52.6.2,1.14.16,1.56.1.48-.07,1.42-.58,1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z"></path>
    </svg>
);

const SupportButton = () => {
    const { role, user, formaAfriqueUser } = useRole();
    const [supportInfo, setSupportInfo] = useState({ email: 'support@formaafrique.com', phone: '+237600000000' });
    const pathname = usePathname();
    const db = getFirestore();
    
    const isAuthPage = pathname === '/login';
    const isInsideChat = pathname.startsWith('/messages/');

    useEffect(() => {
        const settingsRef = doc(db, 'settings', 'global');
        const unsub = onSnapshot(settingsRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setSupportInfo(prev => ({
                    email: data.general?.contactEmail || prev.email,
                    phone: data.general?.supportPhone || prev.phone,
                }));
            }
        });
        return () => unsub();
    }, [db]);

    if ((!user && !isAuthPage) || isInsideChat) {
        return null;
    }
    
    let internalSupportHref = '/questions-reponses';
    if (formaAfriqueUser?.role === 'admin') {
      internalSupportHref = '/admin/support';
    } else if (!user) {
      internalSupportHref = 'mailto:' + supportInfo.email;
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                 <Button
                    className="fixed bottom-24 md:bottom-6 right-6 h-16 w-16 rounded-full shadow-lg z-50 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white"
                    aria-label="Support"
                >
                    <HelpCircle className="h-8 w-8" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 mr-4 mb-2 dark:bg-slate-800 dark:border-slate-700">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none dark:text-white">Contactez le Support</h4>
                        <p className="text-sm text-muted-foreground">Choisissez votre méthode de contact préférée.</p>
                    </div>
                    <div className="grid gap-2">
                        <Button asChild variant="outline" className="justify-start dark:hover:bg-slate-700">
                           <Link href={internalSupportHref}>
                             <MessageSquare className="mr-2 h-4 w-4" /> Discuter sur le site
                           </Link>
                        </Button>
                         <Button asChild variant="outline" className="justify-start dark:hover:bg-slate-700">
                           <a href={`https://wa.me/${supportInfo.phone}`} target="_blank" rel="noopener noreferrer">
                             <WhatsAppIcon className="mr-2 h-4 w-4" /> WhatsApp
                           </a>
                        </Button>
                         <Button asChild variant="outline" className="justify-start dark:hover:bg-slate-700">
                           <a href={`mailto:${supportInfo.email}`}>
                             <Mail className="mr-2 h-4 w-4" /> E-mail
                           </a>
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};


export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, loading: isRoleLoading, user, isUserLoading, formaAfriqueUser, switchRole } = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const isAuthPage = pathname === '/' || pathname === '/register' || pathname === '/login';
  const hasUnreadNotifications = useUnreadNotifications(user?.uid);
  const [siteSettings, setSiteSettings] = useState({ siteName: 'FormaAfrique', logoUrl: '/icon.svg', maintenanceMode: false });
  const db = getFirestore();
  
  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            const settingsData = docSnap.data();
            setSiteSettings({
                siteName: settingsData.general?.siteName || 'FormaAfrique',
                logoUrl: settingsData.general?.logoUrl || '/icon.svg',
                maintenanceMode: settingsData.platform?.maintenanceMode || false,
            });
        }
    });
    return () => unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!isAuthPage && !isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router, isAuthPage]);
  
  const isAdminRoute = pathname.startsWith('/admin');
  
  useEffect(() => {
    if (isAdminRoute && !isRoleLoading && formaAfriqueUser?.role === 'admin' && role !== 'admin') {
      switchRole('admin');
    }
  }, [pathname, isRoleLoading, formaAfriqueUser, role, switchRole, isAdminRoute]);

  const isLoading = isUserLoading || isRoleLoading;

  if (isAuthPage) {
    return (
        <>
            {children}
            <SupportButton />
        </>
    );
  }

  // Show a full-page loader until we know the maintenance status and user role
  if (isLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background dark:bg-[#0f172a]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  // Once loading is complete, check for maintenance mode.
  if (siteSettings.maintenanceMode && formaAfriqueUser?.role !== 'admin') {
    return <MaintenancePage />;
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
    const props = { siteName: siteSettings.siteName, logoUrl: siteSettings.logoUrl };
    switch (role) {
      case 'student':
        return <StudentSidebar {...props} />;
      case 'instructor':
        return <InstructorSidebar {...props} />;
      case 'admin':
        return <AdminSidebar {...props} />;
      default:
        return <StudentSidebar {...props} />;
    }
  };
  
  if (!user) {
    // This can happen briefly during redirects, return null to avoid flashing content.
    return null;
  }
  
  const isStudioRoute = pathname.startsWith('/instructor/courses/edit/');
  if (isStudioRoute) {
    return <>{children}</>;
  }

  const isInstructorAndNotApproved = role === 'instructor' && formaAfriqueUser && !formaAfriqueUser.isInstructorApproved;
  const userIsNotAdmin = formaAfriqueUser?.role !== 'admin';
  const showAdminAccessRequired = isAdminRoute && userIsNotAdmin;
  const isFullScreenPage = pathname.startsWith('/courses/');
  const isChatPage = pathname.startsWith('/messages');
  const showBottomNav = (role === 'student') && isMobile;

  // This handles the full-screen layout for chat pages on mobile.
  if (isMobile && pathname.startsWith('/messages/')) {
    return <main className="h-screen w-screen">{children}</main>;
  }

  return (
    <div className='dark flex flex-col min-h-screen bg-background-alt dark:bg-[#0f172a] tv:text-lg'>
      <AnnouncementBanner />
        <div className="flex flex-1">
            <aside className={cn("hidden md:flex md:flex-col h-screen sticky top-0", isFullScreenPage && "md:hidden")}>
              {renderSidebar()}
            </aside>
            <div className={cn("flex flex-col flex-1", isChatPage && !isMobile && "overflow-hidden")}>
               {!isChatPage && !isFullScreenPage && (
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
                    <div className="flex items-center gap-2">
                        <LanguageSelector />
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
                    </div>
                </header>
              )}
              
              <main className={cn("flex-1 overflow-y-auto", 
                isChatPage && !isMobile ? "" : "p-4 sm:p-6", 
                showBottomNav ? "pb-20" : "")
              }>
                  <div className={cn(!isFullScreenPage && "w-full", isChatPage && !isMobile ? "h-full" : "")}>
                    {!isUserLoading && user && !user.emailVerified && !isFullScreenPage && !isChatPage && (
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
              {!isFullScreenPage && !isChatPage && (
                <>
                  <SupportButton />
                </>
              )}
            </div>
        </div>
    </div>
  );
}

    