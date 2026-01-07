
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  DollarSign,
  BarChart3,
  MessagesSquare,
  Star,
  ClipboardCheck,
  FileQuestion,
  Award,
  Folder,
  Settings,
  LogIn,
  Shield,
  LogOut,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuth, signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';


const instructorMenu = [
  {
    label: 'NAVIGATION',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, text: 'Tableau de bord' },
      { href: '/instructor/courses', icon: BookOpen, text: 'Mes Cours' },
      { href: '/instructor/students', icon: Users, text: 'Mes Étudiants' },
      { href: '/mes-revenus', icon: DollarSign, text: 'Mes Revenus' },
      { href: '/statistiques', icon: BarChart3, text: 'Statistiques' },
    ],
  },
  {
    label: 'INTERACTION',
    items: [
      { href: '/messages', icon: MessagesSquare, text: 'Messages' },
      { href: '/questions-reponses', icon: MessagesSquare, text: 'Questions/Réponses' },
      { href: '/avis', icon: Star, text: 'Avis' },
      { href: '/instructor/devoirs', icon: ClipboardCheck, text: 'Devoirs' },
    ],
  },
  {
    label: 'OUTILS',
    items: [
      { href: '/quiz', icon: FileQuestion, text: 'Quiz' },
      { href: '/certificats-instructor', icon: Award, text: 'Certificats' },
      { href: '/ressources', icon: Folder, text: 'Ressources' },
      { href: '/account', icon: Settings, text: 'Paramètres' },
    ],
  },
];

const SidebarItem = ({ href, icon: Icon, label }: { href: string, icon: React.ElementType, label: string }) => {
  const pathname = usePathname();
  const { formaAfriqueUser } = useRole();
  const { toast } = useToast();
  const isActive = pathname.startsWith(href) && href !== '/dashboard' || pathname === href;
  
  const isAllowedPath = (path: string) => {
    // Allow dashboard and account pages for all instructors
    const alwaysAllowed = ['/dashboard', '/account', '/messages'];
    if (alwaysAllowed.includes(path)) return true;
    
    // For other paths, check for approval
    return formaAfriqueUser?.isInstructorApproved;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isAllowedPath(href)) {
        e.preventDefault();
        toast({
            variant: "destructive",
            title: "Accès refusé",
            description: "Votre compte instructeur est en attente d'approbation.",
        });
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "flex items-center px-4 py-2.5 my-1 cursor-pointer transition-all duration-200 rounded-lg mx-3 group",
        isActive
          ? 'bg-primary text-primary-foreground shadow-md'
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

export function InstructorSidebar({ siteName, logoUrl }: { siteName?: string, logoUrl?: string }) {
  const router = useRouter();
  const { switchRole, formaAfriqueUser, availableRoles } = useRole();
  const { toast } = useToast();
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
          <Image src={logoUrl || "/icon.svg"} width={32} height={32} alt={`${siteName} Logo`} className="rounded-full" />
          <span className="font-bold text-lg text-primary">
            {siteName || 'FormaAfrique'}
          </span>
        </Link>
      </header>

      <nav className="flex-1 py-2 overflow-y-auto">
        {instructorMenu.map((group) => (
          <div key={group.label} className="py-2">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.label}</p>
            {group.items.map((item) => (
              <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.text} />
            ))}
          </div>
        ))}
      </nav>

      <footer className="p-4 mt-auto border-t border-slate-100 space-y-2">
        <Button
          variant="outline"
          className="w-full justify-center"
          onClick={() => switchRole('student')}
        >
          <LogIn className="mr-2 h-4 w-4" />
          Mode Étudiant
        </Button>
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
