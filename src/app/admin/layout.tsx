
'use client';

import { useRole } from "@/context/RoleContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

function AdminAccessRequiredScreen() {
    const router = useRouter();
    return (
        <div className="flex flex-col items-center justify-center h-screen text-center p-4 bg-gray-900 text-white">
             <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold">Accès Interdit</h1>
            <p className="text-gray-400">Vous n'avez pas les autorisations nécessaires pour accéder à cette page.</p>
            <button onClick={() => router.push('/dashboard')} className="mt-6 px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700">
                Retour au tableau de bord
            </button>
        </div>
    )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { formaAfriqueUser, isUserLoading, role, switchRole } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && formaAfriqueUser?.role === 'admin' && role !== 'admin') {
      switchRole('admin');
    }
  }, [isUserLoading, formaAfriqueUser, role, switchRole]);

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (formaAfriqueUser?.role !== 'admin') {
    return <AdminAccessRequiredScreen />;
  }
  
  return (
    <div className="flex h-screen bg-gray-900 text-white">
        <aside className="hidden md:block">
           <AdminSidebar />
        </aside>
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
            {children}
        </main>
    </div>
  )
}
