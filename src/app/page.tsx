
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { africanCountries } from '@/lib/countries'; // Assurez-vous que ce fichier existe

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState('');

  useEffect(() => {
    // Simple detection based on browser language
    const userLang = navigator.language || (navigator as any).userLanguage; // fr-FR, en-US, etc.
    if (userLang) {
      const countryCode = userLang.split('-')[1]?.toUpperCase();
      if (countryCode && africanCountries.some(c => c.code === countryCode)) {
        setDetectedCountry(countryCode);
      }
    }
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log('Logging in...');
    // Logique de connexion ici
    setTimeout(() => setIsLoading(false), 1500);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log('Registering...');
    // Logique d'inscription ici
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-lg">
        <TabsList className="grid w-full grid-cols-2 h-12 rounded-t-xl rounded-b-none">
          <TabsTrigger value="login" className="text-base h-full rounded-tl-xl rounded-b-none data-[state=active]:bg-white data-[state=inactive]:bg-slate-100">
            Connexion
          </TabsTrigger>
          <TabsTrigger value="register" className="text-base h-full rounded-tr-xl rounded-b-none data-[state=active]:bg-white data-[state=inactive]:bg-slate-100">
            Inscription
          </TabsTrigger>
        </TabsList>
        
        <Card className="rounded-t-none rounded-b-xl shadow-lg">
          <TabsContent value="login">
            <CardHeader>
              <CardTitle className="text-3xl font-bold">Se connecter</CardTitle>
              <CardDescription>Accédez à votre tableau de bord.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLoginSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="votre.email@exemple.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Input id="login-password" type="password" required />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Se connecter
                </Button>
              </form>
            </CardContent>
            <div className="p-6 pt-0 text-center text-sm">
                <p>
                    Vous n'avez pas de compte ?{' '}
                    <button onClick={() => setActiveTab('register')} className="font-semibold text-blue-600 hover:underline">
                        S'inscrire
                    </button>
                </p>
            </div>
          </TabsContent>
          
          <TabsContent value="register">
            <CardHeader>
              <CardTitle className="text-3xl font-bold">Créer un compte</CardTitle>
              <CardDescription>Rejoignez la plus grande communauté d'apprenants d'Afrique.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegisterSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstname">Prénom</Label>
                    <Input id="firstname" placeholder="John" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastname">Nom</Label>
                    <Input id="lastname" placeholder="Doe" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input id="register-email" type="email" placeholder="votre.email@exemple.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Mot de passe</Label>
                  <Input id="register-password" type="password" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country-origin">Pays d'origine</Label>
                    <Select>
                      <SelectTrigger id="country-origin">
                        <SelectValue placeholder="Sélectionnez un pays" />
                      </SelectTrigger>
                      <SelectContent>
                        {africanCountries.map(country => (
                          <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country-current">Pays actuel</Label>
                     <Select defaultValue={detectedCountry}>
                      <SelectTrigger id="country-current">
                        <SelectValue placeholder="Sélectionnez un pays" />
                      </SelectTrigger>
                      <SelectContent>
                        {africanCountries.map(country => (
                          <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base" disabled={isLoading}>
                   {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer un compte
                </Button>
              </form>
            </CardContent>
             <div className="p-6 pt-0 text-center text-sm">
                <p>
                    Déjà un compte ?{' '}
                    <button onClick={() => setActiveTab('login')} className="font-semibold text-blue-600 hover:underline">
                        Se connecter
                    </button>
                </p>
            </div>
          </TabsContent>
        </Card>
      </Tabs>
    </div>
  );
}
