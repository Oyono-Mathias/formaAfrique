'use client';

import { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LegalPage() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const db = getFirestore();

  useEffect(() => {
    const fetchLegalContent = async () => {
      try {
        const settingsRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
          const settings = docSnap.data();
          // Assuming privacyPolicy content is for "Mentions Légales"
          setContent(settings.legal?.privacyPolicy || 'Contenu non disponible.');
        } else {
          setContent('Contenu non disponible.');
        }
      } catch (error) {
        console.error("Failed to fetch legal content:", error);
        setContent("Erreur lors du chargement du contenu.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLegalContent();
  }, [db]);

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Mentions Légales & Politique de Confidentialité</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div 
              className="prose dark:prose-invert max-w-none" 
              dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }} 
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
