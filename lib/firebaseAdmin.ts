import admin from 'firebase-admin';

// 1. Initialize sirf tab karein jab zarurat ho aur keys maujood hon
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  // Build time pe ye keys undefined ho sakti hain
  if (privateKey && clientEmail && projectId) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Vercel newline fix
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } catch (error) {
      console.error('Firebase Admin Init Error:', error);
    }
  } else {
    // Ye message build logs mein dikhega, par crash nahi karega
    console.warn("⚠️ Firebase Env Vars missing. Skipping initialization for build.");
  }
}

// 2. SAFE EXPORT (Sabse Important Part)
// Agar app initialize nahi hua (Build time), toh 'db' ko crash mat hone do.
// Hum use 'any' cast kar rahe hain taaki TypeScript shor na machaye.
export const db = (admin.apps.length > 0 ? admin.firestore() : {}) as admin.firestore.Firestore;