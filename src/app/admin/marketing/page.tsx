
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, Percent, PlusCircle, Trash2, Megaphone, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateAnnouncement, type GenerateAnnouncementInput } from '@/ai/flows/generate-announcement-flow';
import { generatePromoCode, type GeneratePromoCodeInput } from '@/ai/flows/generate-promo-code-flow';
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const announcementSchema = z.object({
  message: z.string().min(10, 'Veuillez décrire l\'annonce que vous souhaitez générer.'),
});

const promoCodeSchema = z.object({
  prompt: z.string().min(10, 'Veuillez décrire le code promo que vous souhaitez générer.'),
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;
type PromoCodeFormValues = z.infer<typeof promoCodeSchema>;

interface Announcement {
    id: string;
    text: string;
    createdAt: any;
}

export default function MarketingAIPage() {
  const { toast } = useToast();
  const db = getFirestore();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [generatedCodeResponse, setGeneratedCodeResponse] = useState('');
  const [announcementsHistory, setAnnouncementsHistory] = useState<Announcement[]>([]);

  const announcementForm = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { message: '' },
  });

  const promoCodeForm = useForm<PromoCodeFormValues>({
    resolver: zodResolver(promoCodeSchema),
    defaultValues: { prompt: '' },
  });

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'global');
    getDoc(settingsRef).then(docSnap => {
        if (docSnap.exists()) {
            announcementForm.setValue('message', docSnap.data().platform?.announcementMessage || '');
        }
    });

    const historyQuery = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
        setAnnouncementsHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    });
    return () => unsubscribe();
  }, [db, announcementForm]);

  const handleAiAssist = async () => {
    const currentMessage = announcementForm.getValues('message');
    if (!currentMessage.trim()) {
        toast({ variant: 'destructive', title: 'Champ vide', description: 'Veuillez d\'abord saisir un sujet ou un message à améliorer.' });
        return;
    }
    setIsAiLoading(true);
    try {
      const result = await generateAnnouncement({ topic: currentMessage });
      announcementForm.setValue('message', result.announcement, { shouldValidate: true });
      toast({ title: 'Message amélioré par Mathias !', description: 'La proposition a été insérée dans le champ ci-dessous.' });
    } catch (error) {
      console.error('AI generation failed:', error);
      toast({ variant: 'destructive', title: 'Erreur IA', description: "Impossible de générer l'annonce." });
    } finally {
      setIsAiLoading(false);
    }
  };

  const onAnnouncementSubmit = async (data: AnnouncementFormValues) => {
    setIsSaving(true);
    const settingsRef = doc(db, 'settings', 'global');
    try {
        await setDoc(settingsRef, { platform: { announcementMessage: data.message } }, { merge: true });
        await addDoc(collection(db, 'announcements'), { text: data.message, createdAt: serverTimestamp() });
        toast({ title: 'Annonce mise à jour !', description: 'La nouvelle annonce est maintenant visible sur le site.' });
    } catch (error) {
        console.error('Error saving announcement:', error);
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder l\'annonce.' });
    } finally {
        setIsSaving(false);
    }
  };

  const onPromoCodeSubmit = async (data: PromoCodeFormValues) => {
    setIsGeneratingCode(true);
    setGeneratedCodeResponse('');
    try {
      const result = await generatePromoCode({ prompt: data.prompt });
      setGeneratedCodeResponse(result.response);
      toast({ title: 'Opération terminée !', description: result.response });
      promoCodeForm.reset();
    } catch (error) {
      console.error('Error generating promo code:', error);
      toast({ variant: 'destructive', title: 'Erreur de génération', description: "Une erreur est survenue lors de la communication avec l'IA." });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-white">Marketing par IA</h1>
        <p className="text-slate-400">Utilisez Mathias pour vous assister dans vos tâches marketing.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Announcement Management Card */}
        <Card className="bg-[#1e293b] border-slate-700 flex flex-col">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Megaphone className="h-5 w-5"/> Gestion de l'Annonce Globale</CardTitle>
                <CardDescription className="text-slate-400">
                    Saisissez ou améliorez le message qui s'affichera en bannière sur tout le site.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow">
              <Form {...announcementForm}>
                <form id="announcement-form" onSubmit={announcementForm.handleSubmit(onAnnouncementSubmit)} className="space-y-4">
                  <FormField
                    control={announcementForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Message de l'annonce</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ex: -50% sur tous les cours ce weekend !"
                            {...field}
                            rows={5}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={handleAiAssist} disabled={isAiLoading} className="w-full sm:w-auto bg-slate-800 border-slate-600 hover:bg-slate-700">
                        {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Améliorer avec Mathias
                    </Button>
                     <Button type="submit" form="announcement-form" disabled={isSaving} className="w-full sm:w-auto">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Mettre à jour l'annonce
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="mt-4 border-t border-slate-700 pt-4 flex-col items-start">
                 <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2"><History className="h-4 w-4"/> Historique des annonces</h3>
                 <ScrollArea className="h-32 w-full">
                    <div className="space-y-2 pr-4">
                        {announcementsHistory.map(ann => (
                            <div key={ann.id} onClick={() => announcementForm.setValue('message', ann.text)} className="text-xs p-2 rounded-md bg-slate-800 hover:bg-slate-700 cursor-pointer">
                                <p className="text-slate-300 line-clamp-2">{ann.text}</p>
                                <p className="text-slate-500">{formatDistanceToNow(ann.createdAt.toDate(), { locale: fr, addSuffix: true })}</p>
                            </div>
                        ))}
                    </div>
                 </ScrollArea>
            </CardFooter>
        </Card>

        {/* Promo Code Generation Card */}
        <Card className="bg-[#1e293b] border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Percent className="h-5 w-5"/> Générateur de Codes Promo</CardTitle>
            <CardDescription className="text-slate-400">
              Décrivez une promotion et Mathias créera le code pour vous.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...promoCodeForm}>
              <form onSubmit={promoCodeForm.handleSubmit(onPromoCodeSubmit)} className="space-y-4">
                <FormField
                  control={promoCodeForm.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Votre demande à Mathias</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ex: Crée un code de 25% pour la fête de la jeunesse, valable une semaine."
                          {...field}
                          rows={3}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isGeneratingCode}>
                  {isGeneratingCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Générer le code promo
                </Button>
              </form>
            </Form>
             {generatedCodeResponse && (
                <div className="mt-4 w-full rounded-md bg-slate-800 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white mb-2">Réponse de Mathias :</p>
                    <p>{generatedCodeResponse}</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
