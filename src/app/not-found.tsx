'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Frown } from 'lucide-react';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-center p-4">
      <div className="flex items-center gap-4 mb-8">
        <Image src="/icon.svg" alt="FormaAfrique Logo" width={48} height={48} />
        <span className="text-3xl font-bold text-primary">FormaAfrique</span>
      </div>
      <Frown className="h-20 w-20 text-slate-400 mb-4" />
      <h1 className="text-6xl font-extrabold text-foreground">404</h1>
      <h2 className="text-2xl font-semibold text-muted-foreground mt-2">Page non trouvée</h2>
      <p className="max-w-sm mt-4 text-muted-foreground">
        Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Retour à l'accueil</Link>
      </Button>
    </div>
  );
}
