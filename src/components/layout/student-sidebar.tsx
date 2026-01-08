
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Book,
  Award,
  Bot,
  ClipboardCheck,
  HelpCircle,
  MessageSquare,
  Users,
  User,
  Heart,
  CreditCard,
  Bell,
  LogIn,
  Shield,
  LogOut,
  Star,
  Search,
  Play,
  Briefcase,
} from "lucide-react";
import { getAuth, signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { collection, query, where, onSnapshot, getFirestore, getDoc, doc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Badge } from "../ui/badge";


const SidebarItem = ({ href, icon: Icon, label, unreadCount }: { href: string, icon: React.ElementType, label: string, unreadCount?: number }) => {
  const pathname = usePathname();
  const isActive = (href === '/dashboard' && pathname === href) || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between px-4 py-2.5 my-1 cursor-pointer transition-all duration-200 rounded-lg mx-3 group",
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-slate-700 hover:bg-slate-100'
      )}
    >
      <div className="flex items-center">
        <Icon className={cn(
          "w-5 h-5 mr-4",
          isActive ? 'text-white' : 'text-slate-500 group-hover:text-primary'
        )} />
        <span className="font-medium text-sm">{label}</span>
      </div>
      {unreadCount !== undefined && unreadCount > 0 && (
        <Badge className="bg-red-500 text-white h-5 px-1.5 text-xs">{unreadCount}</Badge>
      )}
    </Link>
  );
};


export function StudentSidebar({ siteName, logoUrl }: { siteName?: string, logoUrl?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { switchRole, availableRoles, user } = useRole();
  const { t } = useTranslation();
  const isInstructor = availableRoles.includes('instructor');
  const isAdmin = availableRoles.includes('admin');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const db = getFirestore();
  const [showInstructorSignup, setShowInstructorSignup] = useState(true);

  const studentMenu = [
    {
      label: t('navPersonal'),
      items: [
        { href: "/dashboard", icon: Star, text: t('navSelection') },
        { href: "/search", icon: Search, text: t('navSearch') },
        { href: "/mes-formations", icon: Play, text: t('navMyLearning') },
        { href: "/tutor", icon: Bot, text: t('navTutor') },
      ],
    },
    {
      label: t('navPersonal'),
      items: [
        { href: "/mes-certificats", icon: Award, text: t('navMyCertificates') },
        { href: "/liste-de-souhaits", icon: Heart, text: t('navWishlist') },
        { href: "/mes-devoirs", icon: ClipboardCheck, text: t('navMyAssignments') },
        { href: "/annuaire", icon: Users, text: t('navDirectory') },
        { href: "/questions-reponses", icon: HelpCircle, text: t('navMyQuestions') },
        { href: "/messages", icon: MessageSquare, text: t('navMessages') },
      ],
    },
    {
      label: t('navAccount'),
      items: [
        { href: "/account", icon: User, text: t('navAccount') },
        { href: "/notifications", icon: Bell, text: t('navNotifications') },
      ],
    },
  ];

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            setShowInstructorSignup(docSnap.data().platform?.allowInstructorSignup ?? true);
        }
    });
    return () => unsubscribe();
  }, [db]);


  useEffect(() => {
    if (!user?.uid) return;

    const chatsQuery = query(collection(db, 'chats'), where('unreadBy', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
        setUnreadMessages(snapshot.size);
    });

    return () => unsubscribe();
  }, [user, db]);

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/');
    toast({ title: "Déconnexion réussie" });
  }

  return (
    <div className="w-64 h-full bg-white border-r border-slate-200 flex flex-col shadow-sm">
      <header className="p-4 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-2">
            <Image src={logoUrl || "/icon.svg"} width={32} height={32} alt={`${siteName} Logo`} className="rounded-full" />
            <span className="font-bold text-lg text-primary">{siteName || 'FormaAfrique'}</span>
        </Link>
      </header>

      <nav className="flex-1 py-2 overflow-y-auto">
        {studentMenu.map((group) => (
          <div key={group.label} className="py-2">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.label}</p>
            {group.items.map((item) => (
              <SidebarItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.text}
                unreadCount={item.href === '/messages' ? unreadMessages : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      <footer className="p-4 mt-auto border-t border-slate-100 space-y-2">
        {isInstructor ? (
            <Button variant="outline" className="w-full justify-center" onClick={() => switchRole('instructor')}>
                <LogIn className="mr-2 h-4 w-4" />
                Mode Instructeur
            </Button>
        ) : showInstructorSignup && (
             <Button variant="outline" className="w-full justify-center" asChild>
                <Link href="/devenir-instructeur">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Devenir Instructeur
                </Link>
            </Button>
        )}
        {isAdmin && (
             <Button variant="secondary" className="w-full justify-center" onClick={() => switchRole('admin')}>
                <Shield className="mr-2 h-4 w-4" />
                Mode Admin
            </Button>
        )}
        <Button variant="destructive" className="w-full justify-center" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </footer>
    </div>
  );
}
