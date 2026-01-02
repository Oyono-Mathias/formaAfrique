
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { useDoc, useMemoFirebase } from '@/firebase';
import { useRole } from '@/context/RoleContext';
import { assistCourseCreation, AssistCourseCreationOutput } from '@/ai/flows/assist-course-creation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, PlusCircle, Trash2 } from 'lucide-react';
import type { Course } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CourseContentPage from './content/page';

const courseEditSchema = z.object({
  title: z.string().min(5, 'Le titre doit contenir au moins 5 caractères.'),
  description: z.string().min(20, 'La description doit contenir au moins 20 caractères.'),
  category: z.string().min(3, 'La catégorie est requise.'),
  imageUrl: z.string().url("Veuillez entrer une URL d'image valide.").optional().or(z.literal('')),
  learningObjectives: z.array(z.object({ value: z.string().min(1, "L'objectif ne peut pas être vide.") })).optional(),
  prerequisites: z.array(z.object({ value: z.string().min(1, "Le prérequis ne peut pas être vide.") })).optional(),
  targetAudience: z.string().optional(),
});

type CourseEditFormValues = z.infer<typeof courseEditSchema>;

export default function EditCoursePage() {
  const { courseId } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const db = getFirestore();
  const { formaAfriqueUser, isUserLoading } = useRole();

  const [isSaving, setIsSaving] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const courseRef = useMemoFirebase(
    () => (courseId ? doc(db, 'courses', courseId as string) : null),
    [db, courseId]
  );
  const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseRef);

  const form = useForm<CourseEditFormValues>({
    resolver: zodResolver(courseEditSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      imageUrl: '',
      learningObjectives: [],
      prerequisites: [],
      targetAudience: '',
    },
  });
  
  const { fields: objectivesFields, append: appendObjective, remove: removeObjective } = useFieldArray({
    control: form.control,
    name: "learningObjectives",
  });
  
  const { fields: prereqFields, append: appendPrereq, remove: removePrereq } = useFieldArray({
    control: form.control,
    name: "prerequisites",
  });

  useEffect(() => {
    if (course) {
      form.reset({
        title: course.title,
        description: course.description,
        category: course.category,
        imageUrl: course.imageUrl,
        learningObjectives: course.learningObjectives?.map((obj: string) => ({ value: obj })) || [],
        prerequisites: course.prerequisites?.map((pre: string) => ({ value: pre })) || [],
        targetAudience: course.targetAudience,
      });
    }
  }, [course, form]);
  
  const handleAiAssist = async () => {
    const title = form.getValues('title');
    if (!title) {
      toast({
        variant: 'destructive',
        title: 'Titre manquant',
        description: "Veuillez d'abord saisir un titre pour le cours.",
      });
      return;
    }
    setIsAiLoading(true);
    try {
      const result: AssistCourseCreationOutput = await assistCourseCreation({ courseTitle: title });
      form.setValue('description', result.description, { shouldValidate: true });
      form.setValue('category', result.category, { shouldValidate: true });
      toast({
        title: 'Contenu généré !',
        description: 'La description et la catégorie ont été remplies par l\'IA.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur IA',
        description: 'La génération de contenu a échoué.',
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const onSubmit = async (data: CourseEditFormValues) => {
    if (!courseId) return;
    setIsSaving(true);
    try {
      const courseDocRef = doc(db, 'courses', courseId as string);
      const updatePayload = {
        ...data,
        learningObjectives: data.learningObjectives?.map(obj => obj.value),
        prerequisites: data.prerequisites?.map(pre => pre.value),
      };
      await updateDoc(courseDocRef, updatePayload);
      toast({
        title: 'Informations enregistrées !',
        description: 'Vos modifications ont été sauvegardées.',
      });

    } catch (error) {
      console.error('Error updating course:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur de sauvegarde',
        description: 'Impossible d\'enregistrer les modifications.',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const isLoading = isCourseLoading || isUserLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="bg-white rounded-2xl shadow-sm">
          <CardHeader>
            <Skeleton className="h-8 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!course) {
    return <div className="text-center p-12 text-foreground">Cours non trouvé.</div>;
  }
  
  const canEdit = formaAfriqueUser && (course.instructorId === formaAfriqueUser.uid || formaAfriqueUser.role === 'admin');

  if (!canEdit) {
    return <div className="text-center p-12 text-destructive">Accès non autorisé.</div>
  }

  return (
    <Tabs defaultValue="info">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="program">Programme</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-6">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Card className="bg-white rounded-2xl shadow-sm border-gray-200/80 transition-shadow hover:shadow-md">
                <CardHeader>
                    <CardTitle className="text-xl">Informations Générales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                    <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Titre du cours</FormLabel>
                        <FormControl>
                            <Input placeholder="Ex: Introduction à Next.js 14" {...field} className="border-gray-200 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex justify-between items-center text-gray-700 font-medium">
                            <span>Description</span>
                            <Button type="button" variant="outline" size="sm" onClick={handleAiAssist} disabled={isAiLoading}>
                            {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2 text-yellow-500" />}
                            Assistance IA
                            </Button>
                        </FormLabel>
                        <FormControl>
                            <Textarea placeholder="Décrivez votre cours en détail..." {...field} rows={6} className="border-gray-200 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary"/>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormField
                        control={form.control}
                        name="imageUrl"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-gray-700 font-medium">URL de l'image de couverture</FormLabel>
                            <FormControl>
                                <Input placeholder="https://picsum.photos/seed/..." {...field} className="border-gray-200 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Catégorie</FormLabel>
                        <FormControl>
                            <Input placeholder="Développement Web" {...field} className="border-gray-200 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary"/>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </CardContent>
                </Card>
                
                <Card className="bg-white rounded-2xl shadow-sm border-gray-200/80 transition-shadow hover:shadow-md">
                <CardHeader>
                    <CardTitle className="text-xl">Objectifs Pédagogiques</CardTitle>
                    <CardDescription>Que vont apprendre les étudiants dans ce cours ? (Ce que vous apprendrez)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                    {objectivesFields.map((field, index) => (
                        <FormField
                        key={field.id}
                        control={form.control}
                        name={`learningObjectives.${index}.value`}
                        render={({ field }) => (
                            <FormItem>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                <Input {...field} placeholder={`Objectif #${index + 1}`} className="border-gray-200 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary"/>
                                </FormControl>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeObjective(index)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Supprimer l'objectif</span>
                                </Button>
                            </div>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full border-dashed border-2 hover:bg-accent hover:border-solid"
                        size="sm"
                        onClick={() => appendObjective({ value: "" })}
                    >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Ajouter un objectif
                    </Button>
                </CardContent>
                </Card>
                
                <Card className="bg-white rounded-2xl shadow-sm border-gray-200/80 transition-shadow hover:shadow-md">
                <CardHeader>
                    <CardTitle className="text-xl">Prérequis</CardTitle>
                    <CardDescription>Quelles sont les connaissances nécessaires pour suivre ce cours ?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                    {prereqFields.map((field, index) => (
                        <FormField
                        key={field.id}
                        control={form.control}
                        name={`prerequisites.${index}.value`}
                        render={({ field }) => (
                            <FormItem>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                <Input {...field} placeholder={`Prérequis #${index + 1}`} className="border-gray-200 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary"/>
                                </FormControl>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removePrereq(index)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    ))}
                    <Button type="button" variant="outline" className="w-full border-dashed border-2 hover:bg-accent hover:border-solid" size="sm" onClick={() => appendPrereq({ value: "" })}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Ajouter un prérequis
                    </Button>
                </CardContent>
                </Card>
                
                <Card className="bg-white rounded-2xl shadow-sm border-gray-200/80 transition-shadow hover:shadow-md">
                <CardHeader>
                    <CardTitle className="text-xl">Public Cible</CardTitle>
                    <CardDescription>À qui s'adresse ce cours ?</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <FormField
                    control={form.control}
                    name="targetAudience"
                    render={({ field }) => (
                        <FormItem>
                        <FormControl>
                            <Textarea placeholder="Ex: Développeurs débutants, chefs de projet, étudiants en marketing..." {...field} rows={4} className="border-gray-200 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary"/>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </CardContent>
                </Card>


                {/* Sticky footer for mobile, regular for desktop */}
                <div className="fixed bottom-0 left-0 right-0 md:relative bg-white/80 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none border-t md:border-none p-4 md:p-0 md:flex md:justify-end md:gap-4 z-50">
                <Button type="submit" disabled={isSaving} className="w-full md:w-auto">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Enregistrer les informations
                </Button>
                </div>
            </form>
            </Form>
        </TabsContent>
        <TabsContent value="program" className="mt-6">
            <CourseContentPage />
        </TabsContent>
    </Tabs>
  );
}

