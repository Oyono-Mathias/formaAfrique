
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Veuillez entrer une adresse e-mail valide." }),
});

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginBackground, setLoginBackground] = useState<string | null>(null);
  const [siteName, setSiteName] = useState('FormaAfrique');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const db = getFirestore();

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  
  useEffect(() => {
    const fetchSettings = async () => {
        const settingsRef = doc(db, 'settings', 'global');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
            const settingsData = settingsSnap.data()?.general;
            if (settingsData?.loginBackgroundImage) {
                setLoginBackground(settingsData.loginBackgroundImage);
            }
             if (settingsData?.logoUrl) {
                setLogoUrl(settingsData.logoUrl);
            }
            if (settingsData?.siteName) {
                setSiteName(settingsData.siteName);
            }
        }
    };
    fetchSettings();
  }, [db]);

  const onSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    setIsLoading(true);
    const auth = getAuth();
    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: 'E-mail envoyé !',
        description: 'Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.',
      });
      router.push('/');
    } catch (error) {
       let description = 'Une erreur inattendue est survenue.';
       if (error instanceof FirebaseError) {
         if (error.code === 'auth/user-not-found') {
           description = 'Aucun utilisateur trouvé avec cet e-mail.';
         } else {
            description = 'Impossible d\'envoyer l\'e-mail. Veuillez réessayer.';
         }
       }
       toast({ variant: 'destructive', title: 'Échec de l\'envoi', description });
    } finally {
      setIsLoading(false);
    }
  };

  const containerStyle = loginBackground 
    ? { backgroundImage: `linear-gradient(rgba(10, 10, 20, 0.8), rgba(0, 0, 0, 0.9)), url('${loginBackground}')` } 
    : {};

  return (
    <div className="auth-page-container" style={containerStyle}>
        <div className="min-h-screen w-full flex items-center justify-center p-4">
            <Card className="auth-card rounded-xl shadow-lg w-full max-w-md">
                <CardHeader className="items-center pb-4">
                    {logoUrl && <Image src={logoUrl} alt={siteName} width={40} height={40} className="mb-2 rounded-full" />}
                    <CardTitle className="text-2xl font-bold text-white">Mot de passe oublié ?</CardTitle>
                    <CardDescription className="text-slate-300 text-center">Entrez votre email pour recevoir un lien de réinitialisation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pb-4">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-white">Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="votre.email@exemple.com" {...field} className="bg-white border-slate-300 text-slate-900 h-9" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-10 text-base !mt-5" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Envoyer le lien
                            </Button>
                        </form>
                    </Form>
                </CardContent>
                <CardContent className="p-4 pt-0 text-center text-sm">
                    <Link href="/" className="font-semibold text-blue-400 hover:underline">
                        Retour à la connexion
                    </Link>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

