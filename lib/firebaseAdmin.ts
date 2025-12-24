import admin from 'firebase-admin';
import serviceAccountKey from '../app/serviceAccountKey.json'; 

if (!admin.apps.length) {
  admin.initializeApp({
    // Yahan humne 'as admin.ServiceAccount' add kiya hai casting ke liye
    credential: admin.credential.cert(serviceAccountKey as admin.ServiceAccount),
  });
}

export const db = admin.firestore();