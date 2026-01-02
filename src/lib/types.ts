
import type { Timestamp } from "firebase/firestore";

export interface Lecture {
  id: string;
  title: string;
  videoUrl?: string;
  duration?: number;
  isFreePreview?: boolean;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  lectures?: Lecture[];
}

export interface Assignment {
  id: string;
  title: string;
  description?: string;
}

export interface Submission {
    id: string;
    userId: string;
    fileURL: string;
    submittedAt: Timestamp;
    grade?: number;
    feedback?: string;
    status: 'Envoyé' | 'Corrigé' | 'En retard';
}

export interface Course {
    id: string;
    courseId?: string; // Maintained for some legacy if needed, but primary is id
    title: string;
    description: string;
    instructorId: string;
    category: string;
    price: number;
    status: 'Draft' | 'Published' | 'Pending Review';
    imageUrl?: string;
    createdAt?: Timestamp;
    publishedAt?: Timestamp;
    currency?: string;
    learningObjectives?: string[];
    prerequisites?: string[];
    targetAudience?: string;
    sections?: Section[];
    isPopular?: boolean;
}

export interface Enrollment {
    id: string;
    studentId: string;
    courseId: string;
    instructorId: string;
    enrollmentDate: Timestamp;
    progress: number;
    completedLessons?: string[];
    lastWatchedLesson?: string;
}

export interface Review {
    id: string;
    courseId: string;
    userId: string;
    rating: number;
    comment: string;
    createdAt: Timestamp;
}
