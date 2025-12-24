import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDspdYIOTzx7bJsdQgoXBLkp40cuMKs2Hs",
  authDomain: "whisperbox-8cab9.firebaseapp.com",
  projectId: "whisperbox-8cab9",
  storageBucket: "whisperbox-8cab9.firebasestorage.app",
  messagingSenderId: "683994494328",
  appId: "1:683994494328:web:f3b4206361a4eb92dcc48d",
  measurementId: "G-QZQLMQH84P"
};
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Auth & Provider (Server pe bhi load ho sakte hain, no issue)
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 3. FIX: Analytics sirf Browser (Client) pe initialize karein
let analytics;

// Check karte hain ki 'window' defined hai ya nahi
if (typeof window !== "undefined") {
  // 'isSupported' check karna safe practice hai
  isSupported().then((yes) => {
    if (yes) {
      analytics = getAnalytics(app);
    }
  });
}

export { auth, provider, analytics, app };