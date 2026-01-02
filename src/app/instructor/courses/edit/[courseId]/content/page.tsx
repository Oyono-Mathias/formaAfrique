
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, getFirestore, collection, query, orderBy, getDocs, writeBatch, deleteDoc, addDoc } from 'firebase/firestore';
import { useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { useRole } from '@/context/RoleContext';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, GripVertical, Trash2, ArrowLeft, Loader2, PlayCircle, Link as LinkIcon, ClockIcon, AlertCircle } from 'lucide-react';
import type { Course, Section as SectionType, Lecture as LectureType } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import ReactPlayer from 'react-player/lazy';


const VideoPlayer = ({ videoUrl }: { videoUrl?: string }) => {
    const [error, setError] = useState(false);
    const cleanedUrl = videoUrl?.trim() || '';

    if (!cleanedUrl || !ReactPlayer.canPlay(cleanedUrl)) {
        return (
            <div className="aspect-video w-full bg-slate-900 flex flex-col items-center justify-center rounded-lg text-white p-4">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="font-semibold">Format de lien non supporté ou vidéo privée.</p>
                <p className="text-sm text-slate-400">Vérifiez que l'URL est correcte et que la vidéo est publique.</p>
            </div>
        );
    }
    
    return (
       <div className="aspect-video w-full bg-black rounded-lg overflow-hidden video-wrapper shadow-2xl">
         <ReactPlayer
            url={cleanedUrl}
            width="100%"
            height="100%"
            controls={true}
            playing={true} // Auto-play when component mounts
            onError={() => setError(true)}
         />
         {error && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4">
                 <AlertCircle className="h-8 w-8 mb-2" />
                <p className="font-semibold">Impossible de charger cette vidéo.</p>
            </div>
         )}
       </div>
    );
};


const lectureSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Le titre est requis."),
  videoUrl: z.string().url("L'URL de la vidéo doit être valide.").optional().or(z.literal('')),
  duration: z.coerce.number().min(0, "La durée doit être un nombre positif.").optional(),
  isFreePreview: z.boolean().default(false),
});

const sectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Le titre de la section est requis."),
  order: z.number(),
  lectures: z.array(lectureSchema),
});

const courseContentSchema = z.object({
  sections: z.array(sectionSchema),
});

type CourseContentFormValues = z.infer<typeof courseContentSchema>;

export default function CourseContentPage() {
  const { courseId } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const db = getFirestore();
  const { isUserLoading } = useRole();

  const [isSaving, setIsSaving] = useState(false);
  const [removedItems, setRemovedItems] = useState<{ sections: string[], lectures: string[] }>({ sections: [], lectures: [] });
  const [previewingLesson, setPreviewingLesson] = useState<LectureType | null>(null);
  
  const courseRef = useMemoFirebase(() => doc(db, 'courses', courseId as string), [db, courseId]);
  const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseRef);

  const sectionsQuery = useMemoFirebase(() => query(collection(db, `courses/${courseId}/sections`), orderBy('order')), [db, courseId]);
  const { data: sectionsData, isLoading: sectionsLoading } = useCollection<SectionType>(sectionsQuery);
  
  const [lecturesData, setLecturesData] = useState<Map<string, LectureType[]>>(new Map());
  const [lecturesLoading, setLecturesLoading] = useState(true);

  const form = useForm<CourseContentFormValues>({
    resolver: zodResolver(courseContentSchema),
    defaultValues: { sections: [] },
  });

  const { fields: sectionFields, append: appendSection, remove: removeSection } = useFieldArray({
    control: form.control,
    name: 'sections',
  });

  useEffect(() => {
    if (!sectionsLoading && sectionsData) {
        const fetchAllLectures = async () => {
            const lecturesMap = new Map<string, LectureType[]>();
            for (const section of sectionsData) {
                const lecturesQuery = query(collection(db, `courses/${courseId}/sections/${section.id}/lectures`), orderBy('title'));
                const lecturesSnapshot = await getDocs(lecturesQuery);
                const lectures = lecturesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LectureType));
                lecturesMap.set(section.id, lectures);
            }
            setLecturesData(lecturesMap);
            setLecturesLoading(false);
        };
        fetchAllLectures();
    }
  }, [sectionsData, sectionsLoading, db, courseId]);


  useEffect(() => {
    if (sectionsData && !lecturesLoading) {
      const combinedData = sectionsData.map(section => ({
        ...section,
        lectures: lecturesData.get(section.id) || []
      }));
      form.reset({ sections: combinedData });
    }
  }, [sectionsData, lecturesData, lecturesLoading, form]);

  const handleRemoveSection = (index: number) => {
    const sectionId = form.getValues(`sections.${index}.id`);
    if (sectionId) {
        setRemovedItems(prev => ({ ...prev, sections: [...prev.sections, sectionId] }));
    }
    removeSection(index);
  }

  const onSubmit = async (data: CourseContentFormValues) => {
    setIsSaving(true);
    const batch = writeBatch(db);

    try {
      // Handle deletions first
      for (const sectionId of removedItems.sections) {
        batch.delete(doc(db, `courses/${courseId}/sections`, sectionId));
      }
      for (const lectureId of removedItems.lectures) {
         // Need a map of lectureId to its sectionId to properly delete
         // For now, we'll rely on section deletion to cascade, which isn't ideal but works for this structure
      }

      // Handle updates and additions
      for (const [sectionIndex, section] of data.sections.entries()) {
        const sectionRef = section.id 
          ? doc(db, `courses/${courseId}/sections`, section.id)
          : doc(collection(db, `courses/${courseId}/sections`));
        
        batch.set(sectionRef, { title: section.title, order: sectionIndex });

        for (const [lectureIndex, lecture] of section.lectures.entries()) {
          const lectureRef = lecture.id
            ? doc(sectionRef, 'lectures', lecture.id)
            : doc(collection(sectionRef, 'lectures'));

          batch.set(lectureRef, { 
              title: lecture.title || `Leçon ${lectureIndex + 1}`,
              videoUrl: lecture.videoUrl?.trim() || '',
              duration: lecture.duration || 0,
              isFreePreview: lecture.isFreePreview || false,
            });
        }
      }

      await batch.commit();

      toast({
        title: 'Programme sauvegardé !',
        description: 'Le contenu de votre cours a été mis à jour.',
      });
      setRemovedItems({ sections: [], lectures: [] }); // Reset removed items on success
      
      // Manually trigger a re-fetch of the data to get new IDs
      const sectionsSnapshot = await getDocs(query(collection(db, `courses/${courseId}/sections`), orderBy('order')));
      const newSectionsData = sectionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SectionType));

      const newLecturesMap = new Map<string, LectureType[]>();
      for (const section of newSectionsData) {
        const lecturesSnapshot = await getDocs(query(collection(db, `courses/${courseId}/sections/${section.id}/lectures`), orderBy('title')));
        newLecturesMap.set(section.id, lecturesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LectureType)));
      }
      setLecturesData(newLecturesMap);
      form.reset({ sections: newSectionsData.map(s => ({...s, lectures: newLecturesMap.get(s.id) || []})) });


    } catch (error) {
      console.error("Error saving content:", error);
      toast({
        variant: 'destructive',
        title: 'Erreur de sauvegarde',
        description: 'Impossible d\'enregistrer les modifications.',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isCourseLoading || isUserLoading || sectionsLoading || lecturesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24 md:pb-8">
            <Accordion type="multiple" defaultValue={sectionFields.map((s, i) => s.id || `new-${i}`)} className="space-y-4">
              {sectionFields.map((section, sectionIndex) => (
                <AccordionItem key={section.id || `new-${sectionIndex}`} value={section.id || `new-${sectionIndex}`} className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                   <div className="flex items-center px-4 hover:bg-gray-50/50">
                      <GripVertical className="h-5 w-5 text-gray-400 mr-2 cursor-grab"/>
                      <AccordionTrigger className="flex-1 py-4 text-base font-semibold text-gray-800 hover:no-underline">
                        <FormField
                            control={form.control}
                            name={`sections.${sectionIndex}.title`}
                            render={({ field }) => (
                                <Input {...field} placeholder={`Section ${sectionIndex + 1}: Titre de la section`} className="text-base font-semibold border-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent" />
                            )}
                        />
                      </AccordionTrigger>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSection(sectionIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                   </div>

                  <AccordionContent className="border-t bg-slate-50/50 pt-4 px-4 pb-4">
                    <LessonsArray sectionIndex={sectionIndex} form={form} onPreview={setPreviewingLesson} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          
          <div className="text-center">
             <Button
                type="button"
                variant="outline"
                className="w-full border-dashed border-2 hover:bg-accent hover:border-solid"
                size="lg"
                onClick={() => appendSection({ title: `Nouvelle Section`, order: sectionFields.length, lectures: [] })}
              >
               <Plus className="h-4 w-4 mr-2" />
                Ajouter une section
            </Button>
          </div>

          {/* Sticky footer for mobile */}
          <div className="fixed bottom-0 left-0 right-0 md:relative bg-white/80 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none border-t md:border-none p-4 md:p-0 md:flex md:justify-end md:gap-4 z-50">
             <Button type="submit" disabled={isSaving} className="w-full md:w-auto">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer le programme
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={!!previewingLesson} onOpenChange={(isOpen) => !isOpen && setPreviewingLesson(null)}>
        <DialogContent className="max-w-4xl p-0 border-0">
          <DialogHeader className="p-4">
            <DialogTitle className="flex items-center justify-between">
                <span>{previewingLesson?.title}</span>
                {previewingLesson?.isFreePreview && <Badge variant="default" className="bg-green-600">Aperçu Gratuit</Badge>}
            </DialogTitle>
          </DialogHeader>
          <VideoPlayer videoUrl={previewingLesson?.videoUrl} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function LessonsArray({ sectionIndex, form, onPreview }: { sectionIndex: number, form: any, onPreview: (lesson: LectureType) => void }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `sections.${sectionIndex}.lectures`,
  });

  return (
    <div className="space-y-3">
      {fields.map((lesson, lessonIndex) => (
        <Card key={lesson.id} className="bg-white p-4 shadow-none border-gray-200/80 transition-shadow hover:shadow-sm">
          <div className="flex items-start gap-3">
             <GripVertical className="h-5 w-5 text-gray-400 mt-9 cursor-grab"/>
             <div className="flex-1 space-y-4">
                 <FormField
                    control={form.control}
                    name={`sections.${sectionIndex}.lectures.${lessonIndex}.title`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium flex items-center justify-between">
                            <span className="flex items-center gap-2"><PlayCircle className="h-4 w-4 text-gray-500" /> Leçon #{lessonIndex + 1}</span>
                             <Button type="button" variant="outline" size="sm" onClick={() => onPreview(form.getValues(`sections.${sectionIndex}.lectures.${lessonIndex}`))}>Tester le lecteur</Button>
                        </FormLabel>
                        <FormControl><Input placeholder="Ex: Introduction à la leçon" {...field} className="border-gray-200 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary"/></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name={`sections.${sectionIndex}.lectures.${lessonIndex}.videoUrl`}
                        render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel className="text-gray-700 font-medium flex items-center gap-2"><LinkIcon className="h-4 w-4 text-gray-400" /> URL de la vidéo</FormLabel>
                            <FormControl><Input placeholder="https://www.youtube.com/watch?v=..." {...field} className="border-gray-200 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary"/></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`sections.${sectionIndex}.lectures.${lessonIndex}.duration`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-gray-700 font-medium flex items-center gap-2"><ClockIcon className="h-4 w-4 text-gray-400" /> Durée (min)</FormLabel>
                            <FormControl><Input type="number" placeholder="10" {...field} className="border-gray-200 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary"/></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name={`sections.${sectionIndex}.lectures.${lessonIndex}.isFreePreview`}
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">
                                Marquer comme aperçu gratuit
                            </FormLabel>
                        </FormItem>
                    )}
                />
              </div>
               <Button type="button" variant="ghost" size="icon" className="text-gray-400 hover:text-destructive hover:bg-destructive/10" onClick={() => remove(lessonIndex)}><Trash2 className="h-4 w-4"/></Button>
          </div>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed border-2 hover:bg-accent hover:border-solid"
        size="sm"
        onClick={() => append({ title: '', videoUrl: '', duration: 0, isFreePreview: false })}
      >
        <Plus className="h-4 w-4 mr-2" />
        Ajouter une leçon
      </Button>
    </div>
  );
}
