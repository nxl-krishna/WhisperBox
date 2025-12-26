import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // ✨ 1. New Import
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDspdYIOTzx7bJsdQgoXBLkp40cuMKs2Hs",
  authDomain: "whisperbox-8cab9.firebaseapp.com",
  projectId: "whisperbox-8cab9",
  storageBucket: "whisperbox-8cab9.firebasestorage.app",
  messagingSenderId: "683994494328",
  appId: "1:683994494328:web:f3b4206361a4eb92dcc48d",
  measurementId: "G-QZQLMQH84P"
};

// Initialize App (Singleton Pattern)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Auth & Provider
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 3. ✨ Database (Firestore) Initialize
const db = getFirestore(app);

// 4. Analytics (Client-side only check)
let analytics;

if (typeof window !== "undefined") {
  isSupported().then((yes) => {
    if (yes) {
      analytics = getAnalytics(app);
    }
  });
}

// ✨ 5. Export 'db' along with others
export { auth, provider, db, analytics, app };