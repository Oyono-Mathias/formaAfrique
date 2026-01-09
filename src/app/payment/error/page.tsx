
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import Link from 'next/link';

function ErrorPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');

    return (
        <div className="flex flex-col justify-center items-center h-screen gap-4 text-center p-4 bg-slate-50">
            <XCircle className="h-20 w-20 text-destructive" />
            <h1 className="text-4xl font-extrabold text-slate-800">Échec du paiement</h1>
            <p className="max-w-md text-slate-600">
                Nous n'avons pas pu traiter votre paiement. Aucuns frais n'ont été appliqués. Veuillez réessayer ou contacter le support si le problème persiste.
            </p>
            <div className="flex gap-4 mt-6">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                    Retour à l'accueil
                </Button>
                {courseId && (
                    <Button asChild>
                        <Link href={`/paiements?courseId=${courseId}`}>Réessayer le paiement</Link>
                    </Button>
                )}
            </div>
        </div>
    );
}

export default function PaymentErrorPage() {
  return (
    <Suspense>
      <ErrorPageContent />
    </Suspense>
  )
}
