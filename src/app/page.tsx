
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, collection, addDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { africanCountries } from '@/lib/countries';
import { errorEmitter } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import type { FormaAfriqueUser } from '@/context/RoleContext';
import Link from 'next/link';


// Schemas for form validation
const loginSchema = z.object({
  email: z.string().email({ message: "Veuillez entrer une adresse e-mail valide." }),
  password: z.string().min(1, { message: "Le mot de passe est requis." }),
  rememberMe: z.boolean().default(false).optional(),
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
  const { t } = useTranslation();
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
    defaultValues: { email: '', password: '', rememberMe: false },
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
      toast({ title: t('loginSuccessTitle') });

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
       toast({ variant: 'destructive', title: t('loginErrorTitle'), description });
    } finally {
      setIsLoading(false);
    }
  };
  
  const createWelcomeChat = async (studentId: string) => {
    // This ID should be a dedicated admin/support account in your production app
    const FORMAAFRIQUE_ADMIN_UID = 'ADMIN_USER_ID_PLACEHOLDER';
    
    // In a real app, you would fetch this from a configuration or have a dedicated support user.
    // For now, we'll assume a placeholder. If you have a known admin UID, replace it here.
    if (FORMAAFRIQUE_ADMIN_UID === 'ADMIN_USER_ID_PLACEHOLDER') {
        console.warn("Action requise: Remplacez 'ADMIN_USER_ID_PLACEHOLDER' par un vrai UID d'administrateur pour envoyer les messages de bienvenue.");
        return;
    }

    const chatDocRef = doc(collection(db, 'chats'));
    const messageCollectionRef = collection(chatDocRef, 'messages');
    const welcomeMessage = t('welcomeMessage');

    try {
      // Create chat document
      await setDoc(chatDocRef, {
        participants: [studentId, FORMAAFRIQUE_ADMIN_UID].sort(),
        lastMessage: welcomeMessage,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastSenderId: FORMAAFRIQUE_ADMIN_UID,
        unreadBy: [studentId], // Mark as unread for the new student
      });

      // Add the first message
      await addDoc(messageCollectionRef, {
        senderId: FORMAAFRIQUE_ADMIN_UID,
        text: welcomeMessage,
        createdAt: serverTimestamp(),
        status: 'sent',
      });
    } catch (error) {
       console.error("Failed to create welcome chat:", error);
       // We don't show a toast here to not interrupt the user's main flow
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
      
      const newUserPayload: Omit<FormaAfriqueUser, 'availableRoles' | 'status'> = {
        uid: user.uid,
        email: user.email || '',
        fullName: fullName,
        role: 'student',
        isInstructorApproved: false,
        createdAt: serverTimestamp() as any, // Cast for serverTimestamp
        profilePictureURL: user.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${fullName}`,
        countryOrigin: values.countryOrigin,
        countryCurrent: values.countryCurrent,
      };

      await setDoc(userDocRef, newUserPayload);

      // After user is created, create the welcome chat
      await createWelcomeChat(user.uid);

      toast({ title: t('registerSuccessTitle'), description: t('registerSuccessDescription') });
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
       toast({ variant: 'destructive', title: t('registerErrorTitle'), description });
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-md">
          <TabsList className="grid w-full grid-cols-2 h-12 rounded-t-xl rounded-b-none p-0 border-b bg-slate-100/10">
            <TabsTrigger 
              value="login" 
              className="text-base h-full rounded-tl-xl rounded-b-none data-[state=active]:bg-white/10 data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-300 text-white"
            >
              {t('loginButton')}
            </TabsTrigger>
            <TabsTrigger 
              value="register" 
              className="text-base h-full rounded-tr-xl rounded-b-none data-[state=active]:bg-white/10 data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-300 text-white"
            >
              {t('registerButton')}
            </TabsTrigger>
          </TabsList>
          
          <Card className="auth-card rounded-t-none rounded-b-xl shadow-lg">
            <TabsContent value="login" className="m-0">
              <CardHeader className="items-center pb-4">
                 {logoUrl && <Image src={logoUrl} alt={siteName} width={40} height={40} className="mb-2 rounded-full" />}
                <CardTitle className="text-2xl font-bold text-white">{t('loginTitle')}</CardTitle>
                <CardDescription className="text-slate-300">{t('loginDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-4">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField control={loginForm.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel className="text-white">{t('emailLabel')}</FormLabel><FormControl><Input placeholder="votre.email@exemple.com" {...field} className="bg-white border-slate-300 text-slate-900 h-9" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={loginForm.control} name="password" render={({ field }) => (
                      <FormItem><FormLabel className="text-white">{t('passwordLabel')}</FormLabel><FormControl><Input type="password" required {...field} className="bg-white border-slate-300 text-slate-900 h-9" /></FormControl><FormMessage /></FormItem>
                    )} />
                    
                    <div className="flex items-center justify-between">
                        <FormField
                            control={loginForm.control}
                            name="rememberMe"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className="border-slate-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                            id="rememberMe"
                                        />
                                    </FormControl>
                                    <FormLabel htmlFor="rememberMe" className="text-sm text-slate-300 font-normal">
                                        {t('rememberMeLabel')}
                                    </FormLabel>
                                </FormItem>
                            )}
                        />
                        <Link href="/forgot-password" className="text-sm font-semibold text-blue-400 hover:underline">
                            {t('forgotPasswordLink')}
                        </Link>
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-10 text-base !mt-5" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('loginButton')}
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardContent className="p-4 pt-0 text-center text-sm">
                  <p className="text-slate-300">
                      {t('noAccountPrompt')}{' '}
                      <button onClick={() => setActiveTab('register')} className="font-semibold text-blue-400 hover:underline">
                          {t('registerLink')}
                      </button>
                  </p>
              </CardContent>
            </TabsContent>
            
            <TabsContent value="register" className="m-0">
              <CardHeader className="items-center pb-4">
                {logoUrl && <Image src={logoUrl} alt={siteName} width={40} height={40} className="mb-2 rounded-full" />}
                <CardTitle className="text-2xl font-bold text-white">{t('registerTitle')}</CardTitle>
                <CardDescription className="text-slate-300">{t('registerDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={registerForm.control} name="firstName" render={({ field }) => (
                            <FormItem><FormLabel className="text-white">{t('firstNameLabel')}</FormLabel><FormControl><Input placeholder="Mathias" {...field} className="bg-white border-slate-300 text-slate-900 h-9" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={registerForm.control} name="lastName" render={({ field }) => (
                            <FormItem><FormLabel className="text-white">{t('lastNameLabel')}</FormLabel><FormControl><Input placeholder="OYONO" {...field} className="bg-white border-slate-300 text-slate-900 h-9" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={registerForm.control} name="email" render={({ field }) => (
                          <FormItem><FormLabel className="text-white">{t('emailLabel')}</FormLabel><FormControl><Input placeholder="nom@exemple.com" {...field} className="bg-white border-slate-300 text-slate-900 h-9" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={registerForm.control} name="password" render={({ field }) => (
                          <FormItem><FormLabel className="text-white">{t('passwordLabel')}</FormLabel><FormControl><Input type="password" placeholder="********" {...field} className="bg-white border-slate-300 text-slate-900 h-9" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-3">
                          <FormField control={registerForm.control} name="countryOrigin" render={({ field }) => (
                            <FormItem><FormLabel className="text-white">{t('countryOriginLabel')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-white border-slate-300 text-slate-900 h-9"><SelectValue placeholder={t('selectPlaceholder')} /></SelectTrigger></FormControl>
                                <SelectContent>{africanCountries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                              </Select><FormMessage /></FormItem>
                          )} />
                          <FormField control={registerForm.control} name="countryCurrent" render={({ field }) => (
                            <FormItem><FormLabel className="text-white">{t('countryCurrentLabel')}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} defaultValue={detectedCountry}>
                                <FormControl><SelectTrigger className="bg-white border-slate-300 text-slate-900 h-9"><SelectValue placeholder={t('selectPlaceholder')} /></SelectTrigger></FormControl>
                                <SelectContent>{africanCountries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                              </Select><FormMessage /></FormItem>
                          )} />
                      </div>
                      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-10 text-base !mt-5" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('createAccountButton')}
                      </Button>
                    </form>
                </Form>
              </CardContent>
              <CardContent className="p-4 pt-0 text-center text-sm">
                  <p className="text-slate-300">
                      {t('alreadyAccountPrompt')}{' '}
                      <button onClick={() => setActiveTab('login')} className="font-semibold text-blue-400 hover:underline">
                          {t('loginLink')}
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
