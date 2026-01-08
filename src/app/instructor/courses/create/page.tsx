
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getFirestore, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const courseCreateSchema = z.object({
  title: z.string().min(5, 'Le titre doit contenir au moins 5 caractères.'),
});

type CourseCreateFormValues = z.infer<typeof courseCreateSchema>;

export default function CreateCoursePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { formaAfriqueUser, isUserLoading } = useRole();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CourseCreateFormValues>({
    resolver: zodResolver(courseCreateSchema),
    defaultValues: {
      title: '',
    },
  });

  const onSubmit = async (data: CourseCreateFormValues) => {
    if (!formaAfriqueUser || !formaAfriqueUser.isInstructorApproved) {
      toast({
        variant: 'destructive',
        title: 'Accès refusé',
        description: 'Votre compte instructeur doit être approuvé pour créer un cours.',
      });
      return;
    }

    setIsSubmitting(true);
    const db = getFirestore();
    const coursesCollection = collection(db, 'courses');

    const newCoursePayload = {
      title: data.title,
      description: '',
      price: 0,
      category: '',
      status: 'Draft',
      instructorId: formaAfriqueUser.uid,
      createdAt: serverTimestamp(),
      publishedAt: null,
      imageUrl: `https://picsum.photos/seed/${new Date().getTime()}/600/400`,
      learningObjectives: [],
      prerequisites: [],
      targetAudience: '',
      contentType: 'video',
      isPopular: false,
      ebookUrl: '',
      // --- AJOUTS OBLIGATOIRES POUR ÉVITER LES CRASHS ---
      participants: [],      // Indispensable pour "Mes Cours"
      isPublished: false     // Indispensable pour la sécurité
    };

    try {
      const docRef = await addDoc(coursesCollection, newCoursePayload);
      
      toast({
        title: 'Cours créé avec succès !',
        description: 'Vous allez être redirigé pour éditer le contenu.',
      });

      router.push(`/instructor/courses/edit/${docRef.id}`);

    } catch (error) {
       console.error('Error creating course:', error);
       errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: coursesCollection.path,
            operation: 'create',
            requestResourceData: newCoursePayload
        }));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Créer un nouveau cours</h1>
        <p className="text-slate-500 mt-1">Commençons par donner un titre à votre nouvelle formation.</p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Titre du cours</CardTitle>
              <CardDescription>
                Ne vous inquiétez pas, vous pourrez le modifier plus tard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Titre du cours</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Apprenez le marketing digital de A à Z" 
                        {...field} 
                        className="text-lg py-6"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end gap-4">
                <Button type="button" variant="ghost" onClick={() => router.back()}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting || isUserLoading} className="bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continuer
                </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
