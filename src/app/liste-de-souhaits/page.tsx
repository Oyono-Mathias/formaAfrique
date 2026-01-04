
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRole } from '@/context/RoleContext';
import { 
  getFirestore, 
  collection, 
  query, 
  onSnapshot,
  doc,
  deleteDoc,
  getDocs,
  where
} from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Course } from '@/lib/types';
import type { FormaAfriqueUser } from '@/context/RoleContext';

interface WishlistItem {
  id: string; // ID du document dans la sous-collection wishlist
  courseId: string;
}

interface WishlistCourse extends Course {
  wishlistItemId: string;
  instructorName?: string;
}

const WishlistCard = ({ course, onRemove }: { course: WishlistCourse, onRemove: (wishlistItemId: string) => void }) => {
  
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(course.wishlistItemId);
  }

  return (
    <div className="relative group bg-white border border-slate-200 rounded-lg overflow-hidden transition-shadow hover:shadow-md">
      <Link href={`/course/${course.id}`} className="flex gap-4">
        <Image
          src={course.imageUrl || `https://picsum.photos/seed/${course.id}/150/100`}
          alt={course.title}
          width={150}
          height={100}
          className="aspect-[3/2] object-cover shrink-0"
        />
        <div className="py-3 pr-4 flex flex-col justify-between flex-1">
          <div>
            <h3 className="font-bold text-sm text-slate-800 line-clamp-2">{course.title}</h3>
            <p className="text-xs text-slate-500 truncate">Par {course.instructorName || 'un instructeur'}</p>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="font-bold text-base text-slate-900">
              {course.price > 0 ? `${course.price.toLocaleString('fr-FR')} FCFA` : 'Gratuit'}
            </p>
            <Button size="sm" className="h-8">
              S'inscrire
            </Button>
          </div>
        </div>
      </Link>
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-2 right-2 h-7 w-7 text-slate-400 hover:bg-red-100 hover:text-red-600"
        onClick={handleRemoveClick}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function WishlistPage() {
  const { user, isUserLoading } = useRole();
  const db = getFirestore();
  const { toast } = useToast();

  const [wishlistCourses, setWishlistCourses] = useState<WishlistCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading) {
      setIsLoading(true);
      return;
    }
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    const wishlistQuery = query(collection(db, `users/${user.uid}/wishlist`));

    const unsubscribe = onSnapshot(wishlistQuery, async (wishlistSnapshot) => {
      if (wishlistSnapshot.empty) {
        setWishlistCourses([]);
        setIsLoading(false);
        return;
      }
      
      const wishlistItems = wishlistSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as WishlistItem));
      
      const courseIds = wishlistItems.map(item => item.courseId).filter(Boolean);
      if (courseIds.length === 0) {
        setWishlistCourses([]);
        setIsLoading(false);
        return;
      }

      // Firestore 'in' query est limité à 30 items. 
      // Si tu as plus de 30 cours, il faudrait faire plusieurs requêtes, mais on simplifie ici.
      const coursesRef = collection(db, 'courses');
      const coursesQuery = query(coursesRef, where('__name__', 'in', courseIds.slice(0, 30)));
      
      const coursesSnapshot = await getDocs(coursesQuery);
      const coursesData = new Map(coursesSnapshot.docs.map(d => [d.id, { id: d.id, ...d.data() } as Course]));
      
      const instructorIds = [...new Set(coursesSnapshot.docs.map(d => d.data().instructorId).filter(Boolean))];
      const instructorsMap = new Map<string, FormaAfriqueUser>();
      
      if (instructorIds.length > 0) {
        const instructorsQuery = query(collection(db, 'users'), where('uid', 'in', instructorIds.slice(0, 30)));
        const instructorsSnapshot = await getDocs(instructorsQuery);
        instructorsSnapshot.forEach(doc => instructorsMap.set(doc.data().uid, doc.data() as FormaAfriqueUser));
      }

      // CORRECTION ICI : Utilisation explicite du Type Guard pour TypeScript
      const populatedCourses: WishlistCourse[] = wishlistItems
        .map(item => {
            const course = coursesData.get(item.courseId);
            if (!course) return null;
            const instructor = instructorsMap.get(course.instructorId);
            return {
                ...course,
                wishlistItemId: item.id,
                instructorName: instructor?.fullName,
                id: course.id
            };
        })
        .filter((course): course is WishlistCourse => course !== null);

      setWishlistCourses(populatedCourses);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching wishlist (permissions?): ", error);
      setWishlistCourses([]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, isUserLoading, db]);

  const handleRemoveFromWishlist = async (wishlistItemId: string) => {
    if (!user?.uid) return;
    
    const docRef = doc(db, `users/${user.uid}/wishlist`, wishlistItemId);
    try {
      await deleteDoc(docRef);
      toast({
        title: 'Retiré de la liste',
        description: 'Le cours a été retiré de votre liste de souhaits.',
      });
    } catch (error) {
      console.error("Error removing from wishlist: ", error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de retirer le cours de la liste.',
      });
    }
  };
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] w-full rounded-xl bg-slate-200" />
          ))}
        </div>
      );
    }
    
    if (wishlistCourses.length === 0) {
      return (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Heart className="mx-auto h-12 w-12 text-red-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-600">Rien ici pour l'instant ❤️</h3>
          <p className="mt-1 text-sm text-slate-500">Parcourez les cours et ajoutez vos favoris.</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/dashboard">Parcourir les cours</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {wishlistCourses.map(course => (
          <WishlistCard key={course.wishlistItemId} course={course} onRemove={handleRemoveFromWishlist} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Ma liste de souhaits</h1>
      </header>
      {renderContent()}
    </div>
  );
}
