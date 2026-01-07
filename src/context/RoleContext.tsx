
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { Dispatch, SetStateAction, ReactNode } from 'react';
import { useUser } from '@/firebase/provider';
import { doc, onSnapshot, getFirestore, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';

export type UserRole = 'student' | 'instructor' | 'admin';

export interface FormaAfriqueUser {
    uid: string;
    email: string;
    fullName: string;
    role: UserRole;
    isInstructorApproved: boolean;
    availableRoles: UserRole[]; // Changed to non-optional
    status?: 'active' | 'suspended';
    bio?: string;
    socialLinks?: {
        website?: string;
        twitter?: string;
        linkedin?: string;
        youtube?: string;
    };
    payoutInfo?: {
        mobileMoneyNumber?: string;
    };
    notificationPreferences?: {
      promotions: boolean;
      reminders: boolean;
    };
    videoPlaybackPreferences?: {
        defaultQuality: string;
        defaultSpeed: string;
    };
    careerGoals?: {
        currentRole?: string;
        interestDomain?: string;
        mainGoal?: string;
    };
    profilePictureURL?: string;
    instructorApplication?: {
        motivation: string;
        verificationDocUrl: string;
        submittedAt: Date;
    };
    createdAt?: Timestamp; // Add createdAt to the type
    countryOrigin?: string;
    countryCurrent?: string;
}

interface RoleContextType {
  role: UserRole;
  setRole: Dispatch<SetStateAction<UserRole>>;
  availableRoles: UserRole[];
  setAvailableRoles: Dispatch<SetStateAction<UserRole[]>>;
  switchRole: (newRole: UserRole) => void;
  loading: boolean;
  formaAfriqueUser: FormaAfriqueUser | null;
  user: User | null; // From Firebase Auth
  isUserLoading: boolean; // From Firebase Auth
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const [formaAfriqueUser, setFormaAfriqueUser] = useState<FormaAfriqueUser | null>(null);
  const [role, setRole] = useState<UserRole>('student');
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>(['student']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading) {
      setLoading(true);
      return;
    }
    
    if (!user) {
      setFormaAfriqueUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getFirestore();
    const userDocRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(userDocRef, (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data() as Omit<FormaAfriqueUser, 'uid' | 'email' | 'availableRoles'>;
          
          const roles: UserRole[] = ['student'];
          if (userData.role === 'instructor' || userData.role === 'admin') {
              roles.push('instructor');
          }
           if (userData.role === 'admin') {
              roles.push('admin');
          }

          const resolvedUser: FormaAfriqueUser = {
              ...userData,
              uid: user.uid,
              email: user.email || '',
              availableRoles: roles,
              profilePictureURL: user.photoURL || userData.profilePictureURL || '',
              status: userData.status || 'active',
          };

          setFormaAfriqueUser(resolvedUser);
          setAvailableRoles(roles);

          const lastRole = localStorage.getItem('formaafrique-role') as UserRole;
          
          let newRole: UserRole;
          
          // Prioritize admin role on fresh login or if last role is not available
          if (userData.role === 'admin') {
            newRole = 'admin';
          } else if (lastRole && roles.includes(lastRole)) {
            newRole = lastRole;
          } else if (roles.includes('instructor')) {
            newRole = 'instructor';
          } else {
            newRole = 'student';
          }

          setRole(newRole);
          localStorage.setItem('formaafrique-role', newRole);

        } else {
            console.warn("User document not found in Firestore for UID:", user.uid);
            const defaultUser: FormaAfriqueUser = {
                uid: user.uid,
                email: user.email || '',
                fullName: user.displayName || 'New User',
                role: 'student',
                status: 'active',
                isInstructorApproved: false,
                availableRoles: ['student'],
                profilePictureURL: user.photoURL || '',
            };
            setFormaAfriqueUser(defaultUser);
            setAvailableRoles(['student']);
            setRole('student');
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching user data:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isUserLoading]);

  const switchRole = useCallback((newRole: UserRole) => {
    if (availableRoles.includes(newRole)) {
      setRole(newRole);
      localStorage.setItem('formaafrique-role', newRole);
    } else {
      console.warn(`Role switch to "${newRole}" denied. Not an available role.`);
    }
  }, [availableRoles]);
  
  const value = useMemo(() => ({
    role,
    setRole,
    availableRoles,
    setAvailableRoles,
    switchRole,
    loading: isUserLoading || loading,
    formaAfriqueUser,
    user,
    isUserLoading
  }), [role, availableRoles, switchRole, loading, formaAfriqueUser, user, isUserLoading]);

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
