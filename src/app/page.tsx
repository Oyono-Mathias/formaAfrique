
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { africanCountries } from '@/lib/countries';
import { errorEmitter } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import type { FormaAfriqueUser } from '@/context/RoleContext';


// Schemas for form validation
const loginSchema = z.object({
  email: z.string().email({ message: "Veuillez entrer une adresse e-mail valide." }),
  password: z.string().min(1, { message: "Le mot de passe est requis." }),
});

const registerSchema = z.object({
  firstName: z.string().min(2, { message: "Le prénom est requis." }),
  lastName: z.string().min(2, { message: "Le nom de famille est requis." }),
  email: z.string().email({ message: "Veuillez entrer une adresse e-mail valide." }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères." }),
  countryOrigin: z.string().optional(),
  countryCurrent: z.string().min(1, "Le pays actuel est requis."),
});


export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState('');
  const [loginBackground, setLoginBackground] = useState<string | null>(null);
  const [siteName, setSiteName] = useState('FormaAfrique');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const db = getFirestore();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      countryOrigin: '',
      countryCurrent: '',
    },
  });

  useEffect(() => {
    // Fetch global settings for background image
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

    // Simple country detection based on browser language
    const userLang = navigator.language || (navigator as any).userLanguage; // e.g., fr-FR, en-US
    if (userLang) {
      const countryCode = userLang.split('-')[1]?.toUpperCase();
      if (countryCode && africanCountries.some(c => c.code === countryCode)) {
        setDetectedCountry(countryCode);
        registerForm.setValue('countryCurrent', countryCode);
      }
    }
  }, [registerForm, db]);

  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    const auth = getAuth();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: "Connexion réussie !" });

      // Fetch user role for redirection
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data()?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
       let description = 'Une erreur inattendue est survenue.';
       if (error instanceof FirebaseError) {
         switch (error.code) {
           case 'auth/user-not-found':
           case 'auth/wrong-password':
           case 'auth/invalid-credential':
             description = 'Email ou mot de passe incorrect.';
             break;
           case 'auth/invalid-email':
             description = 'Veuillez entrer une adresse e-mail valide.';
             break;
           default:
             description = 'Échec de la connexion. Veuillez vérifier vos identifiants.';
         }
       }
       toast({ variant: 'destructive', title: 'Échec de la connexion', description });
    } finally {
      setIsLoading(false);
    }
  };

  const onRegisterSubmit = async (values: z.infer<typeof registerSchema>) => {
    setIsLoading(true);
    const auth = getAuth();
    const fullName = `${values.firstName} ${values.lastName}`;
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: fullName });

      const userDocRef = doc(db, 'users', user.uid);
      
      const newUserPayload = {
        uid: user.uid,
        email: user.email,
        fullName: fullName,
        role: 'student',
        isInstructorApproved: false,
        createdAt: serverTimestamp(),
        profilePictureURL: user.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${fullName}`,
        countryOrigin: values.countryOrigin,
        countryCurrent: values.countryCurrent,
      };

      await setDoc(userDocRef, newUserPayload);

      toast({ title: 'Inscription réussie !', description: 'Bienvenue sur FormaAfrique.' });
      router.push('/dashboard'); // All new users are students, so redirect to student dashboard

    } catch (error) {
       let description = 'Une erreur inattendue est survenue.';
       if (error instanceof FirebaseError) {
         if (error.code === 'auth/email-already-in-use') {
           description = 'Cet email est déjà utilisé. Veuillez vous connecter.';
         } else {
           errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `users/${auth.currentUser?.uid}`, // Approximate path
                operation: 'create',
            }));
           description = 'Impossible de créer le compte. Vérifiez les permissions de la base de données.';
         }
       }
       toast({ variant: 'destructive', title: 'Échec de l\'inscription', description });
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-lg">
          <TabsList className="grid w-full grid-cols-2 h-12 rounded-t-xl rounded-b-none p-0 border-b bg-slate-100/10">
            <TabsTrigger 
              value="login" 
              className="text-base h-full rounded-tl-xl rounded-b-none data-[state=active]:bg-white/10 data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-300 text-white"
            >
              Se connecter
            </TabsTrigger>
            <TabsTrigger 
              value="register" 
              className="text-base h-full rounded-tr-xl rounded-b-none data-[state=active]:bg-white/10 data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-300 text-white"
            >
              Inscription
            </TabsTrigger>
          </TabsList>
          
          <Card className="auth-card rounded-t-none rounded-b-xl shadow-lg">
            <TabsContent value="login" className="m-0">
              <CardHeader className="items-center">
                 {logoUrl && <Image src={logoUrl} alt={siteName} width={48} height={48} className="mb-4 rounded-full" />}
                <CardTitle className="text-3xl font-bold text-white">Se connecter</CardTitle>
                <CardDescription className="text-slate-300">Accédez à votre tableau de bord.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                    <FormField control={loginForm.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel className="text-white">Email</FormLabel><FormControl><Input placeholder="votre.email@exemple.com" {...field} className="bg-white border-slate-300 text-slate-900" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={loginForm.control} name="password" render={({ field }) => (
                      <FormItem><FormLabel className="text-white">Mot de passe</FormLabel><FormControl><Input type="password" required {...field} className="bg-white border-slate-300 text-slate-900" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Se connecter
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardContent className="p-6 pt-0 text-center text-sm">
                  <p className="text-slate-300">
                      Vous n'avez pas de compte ?{' '}
                      <button onClick={() => setActiveTab('register')} className="font-semibold text-blue-400 hover:underline">
                          S'inscrire
                      </button>
                  </p>
              </CardContent>
            </TabsContent>
            
            <TabsContent value="register" className="m-0">
              <CardHeader className="items-center">
                {logoUrl && <Image src={logoUrl} alt={siteName} width={48} height={48} className="mb-4 rounded-full" />}
                <CardTitle className="text-3xl font-bold text-white">Créer un compte</CardTitle>
                <CardDescription className="text-slate-300">Rejoignez la plus grande communauté d'apprenants d'Afrique.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={registerForm.control} name="firstName" render={({ field }) => (
                            <FormItem><FormLabel className="text-white">Prénom</FormLabel><FormControl><Input placeholder="Mathias" {...field} className="bg-white border-slate-300 text-slate-900" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={registerForm.control} name="lastName" render={({ field }) => (
                            <FormItem><FormLabel className="text-white">Nom</FormLabel><FormControl><Input placeholder="OYONO" {...field} className="bg-white border-slate-300 text-slate-900" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={registerForm.control} name="email" render={({ field }) => (
                          <FormItem><FormLabel className="text-white">Email</FormLabel><FormControl><Input placeholder="nom@exemple.com" {...field} className="bg-white border-slate-300 text-slate-900" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={registerForm.control} name="password" render={({ field }) => (
                          <FormItem><FormLabel className="text-white">Mot de passe</FormLabel><FormControl><Input type="password" placeholder="********" {...field} className="bg-white border-slate-300 text-slate-900" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                          <FormField control={registerForm.control} name="countryOrigin" render={({ field }) => (
                            <FormItem><FormLabel className="text-white">Pays d'origine</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-white border-slate-300 text-slate-900"><SelectValue placeholder="Sélectionner" /></SelectTrigger></FormControl>
                                <SelectContent>{africanCountries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                              </Select><FormMessage /></FormItem>
                          )} />
                          <FormField control={registerForm.control} name="countryCurrent" render={({ field }) => (
                            <FormItem><FormLabel className="text-white">Pays actuel</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} defaultValue={detectedCountry}>
                                <FormControl><SelectTrigger className="bg-white border-slate-300 text-slate-900"><SelectValue placeholder="Sélectionner" /></SelectTrigger></FormControl>
                                <SelectContent>{africanCountries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                              </Select><FormMessage /></FormItem>
                          )} />
                      </div>
                      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Créer un compte
                      </Button>
                    </form>
                </Form>
              </CardContent>
              <CardContent className="p-6 pt-0 text-center text-sm">
                  <p className="text-slate-300">
                      Déjà un compte ?{' '}
                      <button onClick={() => setActiveTab('login')} className="font-semibold text-blue-400 hover:underline">
                          Se connecter
                      </button>
                  </p>
              </CardContent>
            </TabsContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
