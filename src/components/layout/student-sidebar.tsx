
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";
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

const studentMenu = [
  {
    label: "NAVIGATION",
    items: [
      { href: "/dashboard", icon: Star, text: "Sélection" },
      { href: "/search", icon: Search, text: "Recherche" },
      { href: "/mes-formations", icon: Play, text: "Mon apprentissage" },
      { href: "/tutor", icon: Bot, text: "Tuteur IA" },
    ],
  },
  {
    label: "PERSONNEL",
    items: [
      { href: "/mes-certificats", icon: Award, text: "Mes Certificats" },
      { href: "/liste-de-souhaits", icon: Heart, text: "Liste de souhaits" },
      { href: "/mes-devoirs", icon: ClipboardCheck, text: "Mes Devoirs" },
      { href: "/annuaire", icon: Users, text: "Annuaire" },
      { href: "/questions-reponses", icon: HelpCircle, text: "Mes Questions" },
      { href: "/messages", icon: MessageSquare, text: "Messages" },
    ],
  },
  {
    label: "COMPTE",
    items: [
      { href: "/account", icon: User, text: "Compte" },
      { href: "/notifications", icon: Bell, text: "Notifications" },
    ],
  },
];

const SidebarItem = ({ href, icon: Icon, label }: { href: string, icon: React.ElementType, label: string }) => {
  const pathname = usePathname();
  const isActive = (href === '/dashboard' && pathname === href) || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center px-4 py-2.5 my-1 cursor-pointer transition-all duration-200 rounded-lg mx-3 group",
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-slate-700 hover:bg-slate-100'
      )}
    >
      <Icon className={cn(
        "w-5 h-5 mr-4",
        isActive ? 'text-white' : 'text-slate-500 group-hover:text-primary'
      )} />
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
};


export function StudentSidebar({ siteName, logoUrl }: { siteName?: string, logoUrl?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { switchRole, availableRoles } = useRole();
  const isInstructor = availableRoles.includes('instructor');
  const isAdmin = availableRoles.includes('admin');

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
            <Image src={logoUrl || "/icon.svg"} width={32} height={32} alt={`${siteName} Logo`} />
            <span className="font-bold text-lg text-primary">{siteName || 'FormaAfrique'}</span>
        </Link>
      </header>

      <nav className="flex-1 py-2 overflow-y-auto">
        {studentMenu.map((group) => (
          <div key={group.label} className="py-2">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.label}</p>
            {group.items.map((item) => (
              <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.text} />
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
        ) : (
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
