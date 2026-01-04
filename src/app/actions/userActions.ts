
'use server';

import { adminAuth, adminDb } from '@/firebase/admin';

export async function deleteUserAccount({ userId, idToken }: { userId: string, idToken: string }): Promise<{ success: boolean, error?: string }> {
    if (!idToken) {
        return { success: false, error: "Aucun token d'authentification." };
    }
    
    try {
        // 1. Verify the token of the user making the request (the admin)
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const adminUid = decodedToken.uid;

        // 2. Verify that the user making the request is an admin
        const adminUserDoc = await adminDb.collection('users').doc(adminUid).get();
        if (!adminUserDoc.exists || adminUserDoc.data()?.role !== 'admin') {
            return { success: false, error: 'Accès non autorisé. Seuls les administrateurs peuvent supprimer des utilisateurs.' };
        }
        
        // Prevent admin from deleting themselves
        if (adminUid === userId) {
            return { success: false, error: 'Un administrateur ne peut pas se supprimer lui-même.' };
        }

        // 3. Delete user from Firebase Authentication
        await adminAuth.deleteUser(userId);

        // 4. Delete user document from Firestore
        await adminDb.collection('users').doc(userId).delete();

        return { success: true };

    } catch (error: any) {
        console.error("Error deleting user:", error);
        if (error.code === 'auth/user-not-found') {
            return { success: false, error: "L'utilisateur n'existe pas dans Firebase Authentication." };
        }
         if (error.code === 'auth/id-token-expired') {
            return { success: false, error: "Le token a expiré. Veuillez vous reconnecter." };
        }
        return { success: false, error: error.message || 'Une erreur inconnue est survenue.' };
    }
}
