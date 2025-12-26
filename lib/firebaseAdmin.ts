import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (privateKey && clientEmail && projectId) {
    try {
      // --- KEY CLEANING LOGIC ---
      let formattedKey = privateKey;

      // 1. Agar key quotes "..." mein band hai (extra safety)
      if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
        formattedKey = formattedKey.slice(1, -1);
      }

      // 2. Convert literal '\n' characters to actual newlines
      formattedKey = formattedKey.replace(/\\n/g, '\n');

      // --- DEBUGGING (Sirf first line print karega security ke liye) ---
      console.log("🔍 Checking Private Key Format:");
      console.log(`   Starts with Header? ${formattedKey.startsWith('-----BEGIN PRIVATE KEY-----')}`);
      console.log(`   Ends with Footer?   ${formattedKey.includes('-----END PRIVATE KEY-----')}`);
      console.log(`   First 20 chars:     ${formattedKey.substring(0, 20)}...`);

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedKey,
        }),
      });
      console.log("🔥 Firebase Admin Initialized Successfully");
    } catch (error) {
      console.error("❌ Firebase Admin Init Error:", error);
    }
  } else {
    console.warn("⚠️ Firebase Env Vars missing. Skipping initialization.");
  }
}

export const getDb = () => {
  initAdmin();
  return admin.firestore();
};

export const verifyToken = async (token: string) => {
  initAdmin();
  return admin.auth().verifyIdToken(token);
};