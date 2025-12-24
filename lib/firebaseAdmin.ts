import admin from 'firebase-admin';

// Helper function jo Firebase ko safe tarike se initialize karega
function initAdmin() {
  // Agar already initialized hai, to wapas mat karo
  if (admin.apps.length > 0) {
    return;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  // Sirf tab init karo jab keys maujood hon (Runtime pe)
  if (privateKey && clientEmail && projectId) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      console.log("🔥 Firebase Admin Initialized");
    } catch (error) {
      console.error("Firebase Admin Init Error:", error);
    }
  }
}

// 1. Export DB Function (Lazy Load)
export const getDb = () => {
  initAdmin(); // Pehle init karega
  return admin.firestore(); // Phir DB dega
};

// 2. Export Auth Function (Lazy Load)
export const verifyToken = async (token: string) => {
  initAdmin(); // Pehle init karega
  return admin.auth().verifyIdToken(token);
};