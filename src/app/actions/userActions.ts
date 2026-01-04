
'use server';

import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase Admin SDK
// This should only run once
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    } catch (error: any) {
        console.error('Firebase admin initialization error', error.stack);
    }
}


export async function deleteUserAccount({ userId, headers: customHeaders }: { userId: string, headers?: { Authorization: string } }): Promise<{ success: boolean, error?: string }> {
    const headersList = customHeaders ? new Headers(customHeaders) : headers();
    const idToken = headersList.get('Authorization')?.split('Bearer ')[1];

    if (!idToken) {
        return { success: false, error: "Aucun token d'authentification." };
    }
    
    try {
        // 1. Verify the token of the user making the request (the admin)
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const adminUid = decodedToken.uid;

        // 2. Verify that the user making the request is an admin
        const adminUserDoc = await getFirestore().collection('users').doc(adminUid).get();
        if (!adminUserDoc.exists || adminUserDoc.data()?.role !== 'admin') {
            return { success: false, error: 'Accès non autorisé. Seuls les administrateurs peuvent supprimer des utilisateurs.' };
        }
        
        // Prevent admin from deleting themselves
        if (adminUid === userId) {
            return { success: false, error: 'Un administrateur ne peut pas se supprimer lui-même.' };
        }

        // 3. Delete user from Firebase Authentication
        await getAuth().deleteUser(userId);

        // 4. Delete user document from Firestore
        await getFirestore().collection('users').doc(userId).delete();

        return { success: true };

    } catch (error: any) {
        console.error("Error deleting user:", error);
        if (error.code === 'auth/user-not-found') {
            return { success: false, error: "L'utilisateur n'existe pas dans Firebase Authentication." };
        }
        return { success: false, error: error.message || 'Une erreur inconnue est survenue.' };
    }
}
