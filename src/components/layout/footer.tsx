
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Twitter, Youtube, Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-400">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
                <Image src="/icon.svg" alt="FormaAfrique Logo" width={28} height={28} />
                <span className="font-bold text-lg text-white">FormaAfrique</span>
            </Link>
            <p className="text-sm max-w-md">
                La plateforme n°1 pour apprendre un métier. Accédez à nos formations gratuites et premium, conçues par des experts locaux pour le marché africain.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Navigation</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/search" className="hover:text-primary">Tous les cours</Link></li>
              <li><Link href="/devenir-instructeur" className="hover:text-primary">Devenir Formateur</Link></li>
              <li><Link href="/tutor" className="hover:text-primary">Tuteur IA</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Légal</h3>
            <ul className="space-y-2 text-sm">
                <li><Link href="/mentions-legales" className="hover:text-primary">Mentions Légales</Link></li>
                <li><Link href="/cgu" className="hover:text-primary">Conditions d'Utilisation</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-slate-500">© {new Date().getFullYear()} FormaAfrique. Tous droits réservés.</p>
            <div className="flex items-center gap-4 mt-4 sm:mt-0">
                <Link href="#" className="hover:text-white"><Twitter className="h-5 w-5" /></Link>
                <Link href="#" className="hover:text-white"><Youtube className="h-5 w-5" /></Link>
                <Link href="#" className="hover:text-white"><Linkedin className="h-5 w-5" /></Link>
            </div>
        </div>
      </div>
    </footer>
  );
}
