
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  MessageSquare,
  HelpCircle,
  Settings,
  ShieldAlert,
  LogOut,
  ChevronDown
} from "lucide-react";
import { getAuth, signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";


const adminMenu = [
    { href: "/admin/dashboard", icon: LayoutDashboard, text: "Tableau de bord" },
    { href: "/admin/users", icon: Users, text: "Utilisateurs" },
    { href: "/admin/moderation", icon: ShieldAlert, text: "Modération" },
    { href: "/admin/courses", icon: BookOpen, text: "Formations" },
    { href: "/admin/payments", icon: CreditCard, text: "Finances" },
    { href: "/admin/support", icon: HelpCircle, text: "Support" },
    { href: "/messages", icon: MessageSquare, text: "Messagerie" },
    { href: "/admin/settings", icon: Settings, text: "Paramètres" },
];


const SidebarItem = ({ href, icon: Icon, label }: { href: string, icon: React.ElementType, label: string }) => {
  const pathname = usePathname();
  const isActive = (href === '/admin/dashboard' && pathname === href) || (href !== '/admin/dashboard' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center px-4 py-2.5 my-1 cursor-pointer transition-all duration-200 rounded-lg mx-3 group",
        isActive
          ? 'bg-primary text-primary-foreground shadow-md'
          : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
      )}
    >
      <Icon className={cn(
        "w-5 h-5 mr-4",
        isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'
      )} />
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
};


export function AdminSidebar() {
  const router = useRouter();
  const { toast } = useToast();
  const { switchRole } = useRole();

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/');
    toast({ title: "Déconnexion réussie" });
  }

  return (
    <div className="w-64 h-full bg-[#1e293b] border-r border-slate-700 flex flex-col shadow-sm">
       <header className="p-4 border-b border-slate-700/50">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
            <Image src="/icon.svg" width={32} height={32} alt="FormaAfrique Logo" />
            <span className="font-bold text-lg text-white">Admin Panel</span>
        </Link>
      </header>

      <nav className="flex-1 py-2 overflow-y-auto">
          {adminMenu.map((item) => (
            <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.text} />
          ))}
      </nav>

      <footer className="p-4 mt-auto space-y-2 border-t border-slate-700/50">
        <Button variant="outline" className="w-full justify-center bg-slate-700 border-slate-600 hover:bg-slate-600 text-white" onClick={() => switchRole('student')}>
            <LogOut className="mr-2"/>
            Quitter Admin
        </Button>
      </footer>
    </div>
  );
}
