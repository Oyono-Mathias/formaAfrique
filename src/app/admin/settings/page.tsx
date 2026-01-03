
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Settings, Percent, Building, Shield, FileText } from 'lucide-react';
import { useRole } from '@/context/RoleContext';

const generalSchema = z.object({
  siteName: z.string().min(1, 'Le nom du site est requis.'),
  siteDescription: z.string().optional(),
  contactEmail: z.string().email('Veuillez entrer un email valide.'),
  logoUrl: z.string().url('Veuillez entrer une URL valide.').optional().or(z.literal('')),
});

const commercialSchema = z.object({
  commissionRate: z.coerce.number().min(0).max(100, 'Le taux doit être entre 0 et 100.'),
  minimumPayout: z.coerce.number().min(0, 'Le seuil ne peut pas être négatif.'),
  enableMobileMoney: z.boolean().default(true),
});

const platformSchema = z.object({
  maintenanceMode: z.boolean().default(false),
  allowInstructorSignup: z.boolean().default(true),
  announcementMessage: z.string().optional(),
});

const legalSchema = z.object({
  termsOfService: z.string().optional(),
  privacyPolicy: z.string().optional(),
});

const settingsSchema = z.object({
  general: generalSchema,
  commercial: commercialSchema,
  platform: platformSchema,
  legal: legalSchema,
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const defaultLegalContent = {
  terms: `
**Conditions Générales d'Utilisation (CGU) de FormaAfrique**

*Dernière mise à jour : [Date]*

Bienvenue sur FormaAfrique !

**1. Objet**
Les présentes CGU régissent l'accès et l'utilisation de la plateforme de cours en ligne FormaAfrique. La plateforme met en relation des créateurs de contenu pédagogique ("Instructeurs") et des personnes souhaitant suivre des formations ("Étudiants").

**2. Inscription et Compte**
L'accès aux cours nécessite la création d'un compte. Vous vous engagez à fournir des informations exactes et à les maintenir à jour. Vous êtes seul responsable de la sécurité de votre mot de passe et de toutes les activités sur votre compte.

**3. Paiements et Modèle de Revenus**
3.1. Les prix des cours sont fixés par les Instructeurs et indiqués en devise locale (XOF, FCFA, etc.).
3.2. FormaAfrique facilite les paiements via des solutions de Mobile Money (Orange Money, MTN Mobile Money, Wave, etc.) et d'autres moyens de paiement locaux pertinents. En effectuant un achat, vous acceptez les conditions de nos prestataires de paiement.
3.3. En achetant un cours, l'Étudiant obtient une licence d'utilisation personnelle, non exclusive et non transférable pour visionner le contenu pédagogique via la plateforme FormaAfrique. Vous n'acquérez aucun droit de propriété ou de distribution.
3.4. **Modèle de Commission :** L'Instructeur autorise FormaAfrique à prélever automatiquement une commission sur le prix de vente de chaque cours vendu. Le taux de cette commission est défini dans les paramètres de la plateforme et peut être sujet à modification.

**4. Propriété Intellectuelle**
4.1. **Contenu des Instructeurs :** Les Instructeurs garantissent détenir tous les droits de propriété intellectuelle (droits d'auteur, etc.) sur le contenu qu'ils publient (vidéos, documents, quiz). Ils conservent l'entière propriété de leur contenu.
4.2. **Licence d'Exploitation :** En publiant un cours, l'Instructeur accorde à FormaAfrique une licence mondiale, non exclusive et révocable, pour héberger, promouvoir, vendre et diffuser son contenu sur la plateforme et via ses canaux marketing. Cette licence prend fin si le cours est retiré de la plateforme par l'Instructeur.
4.3. **Contenu de la Plateforme :** La marque FormaAfrique, le logo, le design, et les textes de la plateforme sont la propriété exclusive de FormaAfrique et protégés par les lois en vigueur.

**5. Responsabilité**
5.1. FormaAfrique agit en tant qu'intermédiaire technique. Nous ne sommes pas responsables de la qualité pédagogique, de l'exactitude ou de la pertinence du contenu des cours, qui relève de l'entière responsabilité de chaque Instructeur.
5.2. En cas de litige entre un Étudiant et un Instructeur concernant le contenu d'un cours, FormaAfrique pourra, à sa discrétion, proposer une médiation mais ne pourra être tenue pour responsable du préjudice allégué.

**6. Droit Applicable et Juridiction**
Les présentes CGU sont soumises au droit en vigueur dans le pays d'opération principal de FormaAfrique (par exemple, le droit camerounais). Tout litige sera de la compétence exclusive des tribunaux de sa capitale économique.
`,
  privacy: `
**Politique de Confidentialité de FormaAfrique**

*Dernière mise à jour : [Date]*

La protection de vos données personnelles est une priorité pour FormaAfrique.

**1. Données Collectées**
Nous collectons les informations que vous nous fournissez lors de votre inscription et de votre utilisation de nos services :
- **Données d'identification :** Nom, prénom, adresse e-mail.
- **Données de profil :** Biographie, liens vers les réseaux sociaux (pour les instructeurs).
- **Données de navigation :** Adresse IP, type de navigateur, pages visitées pour améliorer nos services.
- **Données de progression :** Cours suivis, progression, résultats aux devoirs et quiz.
- **Données financières des Instructeurs :** Informations nécessaires au paiement des revenus (numéro Mobile Money, coordonnées bancaires), stockées de manière sécurisée.
- **Documents de vérification (Instructeurs) :** Les pièces d'identité ou justificatifs de compétence sont collectés à des fins de vérification uniquement.

**2. Utilisation de vos Données**
Vos données sont utilisées pour :
- Fournir, gérer et améliorer nos services (accès aux cours, suivi de la progression).
- Personnaliser votre expérience d'apprentissage.
- Traiter les paiements des cours et les revenus des instructeurs.
- Communiquer avec vous concernant les cours ou les mises à jour de la plateforme.
- Assurer la sécurité de la plateforme et prévenir la fraude.
- Valider le statut des instructeurs.

**3. Stockage et Sécurité des Données**
- Vos données sont hébergées sur l'infrastructure sécurisée de Google Cloud (Firebase), qui respecte les standards internationaux de sécurité des données.
- **Confidentialité des documents :** Les documents de vérification soumis par les instructeurs sont stockés de manière sécurisée, accessibles uniquement par une équipe d'administration restreinte et ne sont jamais partagés avec des tiers. Ils sont utilisés exclusivement pour le processus d'approbation.
- Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles (cryptage, règles d'accès strictes) pour protéger vos données.

**4. Partage des Données**
Nous ne vendons, ni ne louons vos données personnelles à des tiers.
Vos données peuvent être partagées uniquement avec :
- Les instructeurs (votre nom et votre progression dans leurs cours).
- Nos prestataires de services techniques (hébergement, traitement des paiements) qui sont contractuellement tenus de protéger vos données.

**5. Vos Droits**
Conformément à la législation en vigueur sur la protection des données (par exemple, la loi camerounaise de 2010 sur la cybersécurité et la cybercriminalité), vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous à notre adresse email officielle.
`
};

export default function AdminSettingsPage() {
    const { formaAfriqueUser, isUserLoading } = useRole();
    const db = getFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const settingsDocRef = doc(db, 'settings', 'global_config');

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            general: { siteName: 'FormaAfrique', siteDescription: '', contactEmail: '', logoUrl: '' },
            commercial: { commissionRate: 20, minimumPayout: 5000, enableMobileMoney: true },
            platform: { maintenanceMode: false, allowInstructorSignup: true, announcementMessage: '' },
            legal: { 
                termsOfService: defaultLegalContent.terms.trim(),
                privacyPolicy: defaultLegalContent.privacy.trim(),
            },
        },
    });

    useEffect(() => {
      const fetchSettings = async () => {
        try {
          const docSnap = await getDoc(settingsDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            form.reset({
              general: data.general || form.getValues('general'),
              commercial: data.commercial || form.getValues('commercial'),
              platform: data.platform || form.getValues('platform'),
              legal: data.legal || form.getValues('legal'),
            });
          } else {
            // If the document doesn't exist, create it with default values
            await setDoc(settingsDocRef, form.getValues(), { merge: true });
          }
        } catch (error) {
          console.error("Failed to fetch or create settings:", error);
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: 'Impossible de charger les paramètres de la plateforme.',
          });
        } finally {
          setIsLoading(false);
        }
      };

      fetchSettings();
      // We only want to run this once on mount, so we pass an empty dependency array.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    const handleSave = async (data: Partial<SettingsFormValues>) => {
        if (formaAfriqueUser?.role !== 'admin') {
            toast({ variant: 'destructive', title: 'Accès refusé' });
            return;
        }

        setIsSaving(true);
        try {
            await setDoc(settingsDocRef, data, { merge: true });
            toast({
                title: 'Paramètres sauvegardés',
                description: 'Les réglages de la section ont été mis à jour.',
            });
        } catch (error) {
            console.error("Failed to save settings:", error);
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Impossible de sauvegarder les paramètres.',
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const onGeneralSubmit = (data: Pick<SettingsFormValues, 'general'>) => handleSave({ general: data.general });
    const onCommercialSubmit = (data: Pick<SettingsFormValues, 'commercial'>) => handleSave({ commercial: data.commercial });
    const onPlatformSubmit = (data: Pick<SettingsFormValues, 'platform'>) => handleSave({ platform: data.platform });
    const onLegalSubmit = (data: Pick<SettingsFormValues, 'legal'>) => handleSave({ legal: data.legal });

    if (isLoading || isUserLoading) {
        return (
             <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <Form {...form}>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Paramètres</h1>
                    <p className="text-slate-400">Gérez les configurations globales de la plateforme.</p>
                </div>

                <Tabs defaultValue="general" orientation="vertical" className="flex flex-col md:flex-row gap-8">
                    <TabsList className="w-full md:w-48 h-full flex-shrink-0 flex-col justify-start items-stretch bg-slate-800 border-slate-700">
                        <TabsTrigger value="general" className="w-full justify-start gap-2 text-slate-300 data-[state=active]:bg-slate-700 data-[state=active]:text-white"><Settings className="h-4 w-4"/> Général</TabsTrigger>
                        <TabsTrigger value="commercial" className="w-full justify-start gap-2 text-slate-300 data-[state=active]:bg-slate-700 data-[state=active]:text-white"><Percent className="h-4 w-4"/> Commercial</TabsTrigger>
                        <TabsTrigger value="platform" className="w-full justify-start gap-2 text-slate-300 data-[state=active]:bg-slate-700 data-[state=active]:text-white"><Building className="h-4 w-4"/> Plateforme</TabsTrigger>
                        <TabsTrigger value="legal" className="w-full justify-start gap-2 text-slate-300 data-[state=active]:bg-slate-700 data-[state=active]:text-white"><FileText className="h-4 w-4"/> Légal</TabsTrigger>
                    </TabsList>
                    
                    <div className="flex-1">
                        <TabsContent value="general">
                            <Card className="bg-[#1e293b] border-slate-700">
                                <form onSubmit={form.handleSubmit(onGeneralSubmit)}>
                                    <CardHeader><CardTitle className="text-white">Informations Générales</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <FormField control={form.control} name="general.siteName" render={({ field }) => (
                                            <FormItem><FormLabel className="text-slate-300">Nom du site</FormLabel><FormControl><Input {...field} className="bg-slate-700 border-slate-600 text-white" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="general.logoUrl" render={({ field }) => (
                                            <FormItem><FormLabel className="text-slate-300">URL du Logo</FormLabel><FormControl><Input {...field} className="bg-slate-700 border-slate-600 text-white" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="general.contactEmail" render={({ field }) => (
                                            <FormItem><FormLabel className="text-slate-300">Email de contact</FormLabel><FormControl><Input {...field} className="bg-slate-700 border-slate-600 text-white" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="general.siteDescription" render={({ field }) => (
                                            <FormItem><FormLabel className="text-slate-300">Description SEO</FormLabel><FormControl><Textarea {...field} rows={3} className="bg-slate-700 border-slate-600 text-white" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </CardContent>
                                    <CardFooter className="justify-end">
                                        <Button type="submit" disabled={isSaving}>
                                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Enregistrer
                                        </Button>
                                    </CardFooter>
                                </form>
                            </Card>
                        </TabsContent>
                         <TabsContent value="commercial">
                            <Card className="bg-[#1e293b] border-slate-700">
                                 <form onSubmit={form.handleSubmit(onCommercialSubmit)}>
                                    <CardHeader><CardTitle className="text-white">Finances & Paiements</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <FormField control={form.control} name="commercial.commissionRate" render={({ field }) => (
                                            <FormItem><FormLabel className="text-slate-300">Taux de commission (%)</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-700 border-slate-600 text-white" /></FormControl><FormDescription className="text-slate-400">Ce taux sera appliqué à toutes les nouvelles ventes.</FormDescription><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="commercial.minimumPayout" render={({ field }) => (
                                            <FormItem><FormLabel className="text-slate-300">Seuil de retrait minimum (XOF)</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-700 border-slate-600 text-white" /></FormControl><FormDescription className="text-slate-400">Le montant minimum qu'un instructeur doit atteindre pour demander un retrait.</FormDescription><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="commercial.enableMobileMoney" render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-700 p-3 shadow-sm bg-slate-800/50"><div className="space-y-0.5"><FormLabel className="text-slate-200">Paiements Mobile Money</FormLabel><FormDescription className="text-slate-400">Activer ou désactiver les paiements par Orange/MTN Money.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                        )} />
                                    </CardContent>
                                    <CardFooter className="justify-end">
                                        <Button type="submit" disabled={isSaving}>
                                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Enregistrer
                                        </Button>
                                    </CardFooter>
                                </form>
                            </Card>
                        </TabsContent>
                         <TabsContent value="platform">
                            <Card className="bg-[#1e293b] border-slate-700">
                                <form onSubmit={form.handleSubmit(onPlatformSubmit)}>
                                    <CardHeader><CardTitle className="text-white">Configuration de la Plateforme</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <FormField control={form.control} name="platform.maintenanceMode" render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-700 p-3 shadow-sm bg-slate-800/50"><div className="space-y-0.5"><FormLabel className="text-slate-200">Mode Maintenance</FormLabel><FormDescription className="text-slate-400">Coupe l'accès public au site et affiche une page de maintenance.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                        )} />
                                        <FormField control={form.control} name="platform.allowInstructorSignup" render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-700 p-3 shadow-sm bg-slate-800/50"><div className="space-y-0.5"><FormLabel className="text-slate-200">Inscriptions des Instructeurs</FormLabel><FormDescription className="text-slate-400">Autoriser ou non les nouvelles candidatures d'instructeurs.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                        )} />
                                        <FormField control={form.control} name="platform.announcementMessage" render={({ field }) => (
                                            <FormItem><FormLabel className="text-slate-300">Message d'annonce global</FormLabel><FormControl><Textarea {...field} rows={2} className="bg-slate-700 border-slate-600 text-white"/></FormControl><FormDescription className="text-slate-400">Ce message s'affichera en bandeau sur tout le site (si le thème le supporte).</FormDescription><FormMessage /></FormItem>
                                        )} />
                                    </CardContent>
                                    <CardFooter className="justify-end">
                                        <Button type="submit" disabled={isSaving}>
                                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Enregistrer
                                        </Button>
                                    </CardFooter>
                                </form>
                            </Card>
                        </TabsContent>
                         <TabsContent value="legal">
                            <Card className="bg-[#1e293b] border-slate-700">
                                <form onSubmit={form.handleSubmit(onLegalSubmit)}>
                                    <CardHeader><CardTitle className="text-white">Contenu Légal & Sécurité</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <FormField control={form.control} name="legal.termsOfService" render={({ field }) => (
                                            <FormItem><FormLabel className="text-slate-300">Conditions Générales d'Utilisation</FormLabel><FormControl><Textarea {...field} rows={10} className="bg-slate-700 border-slate-600 text-white"/></FormControl><FormDescription className="text-slate-400">Le contenu de votre page CGU.</FormDescription><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="legal.privacyPolicy" render={({ field }) => (
                                            <FormItem><FormLabel className="text-slate-300">Politique de Confidentialité</FormLabel><FormControl><Textarea {...field} rows={10} className="bg-slate-700 border-slate-600 text-white"/></FormControl><FormDescription className="text-slate-400">Le contenu de votre page de politique de confidentialité.</FormDescription><FormMessage /></FormItem>
                                        )} />
                                    </CardContent>
                                    <CardFooter className="justify-end">
                                        <Button type="submit" disabled={isSaving}>
                                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Enregistrer
                                        </Button>
                                    </CardFooter>
                                </form>
                            </Card>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </Form>
    );
}

    