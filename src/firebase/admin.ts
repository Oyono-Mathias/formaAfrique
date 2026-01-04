
import * as admin from 'firebase-admin';

// Ensure the app is initialized only once
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines in the private key
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error: any) {
    console.error('Firebase Admin Initialization Error:', error.stack);
    // In a real-world scenario, you might want to handle this more gracefully
    // For now, we let it throw, which will cause server actions to fail.
    throw new Error('Failed to initialize Firebase Admin SDK. Check server environment variables.');
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
