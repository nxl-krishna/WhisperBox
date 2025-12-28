'use client';
import { useState, useEffect } from 'react'; //
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider } from "../lib/firebaseClient"; 
import { messageToHashInt, generateBlindingFactor, blindMessage, unblindSignature } from '@/lib/cryptoUtils';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebaseClient";
import { v4 as uuidv4 } from 'uuid';
import imageCompression from 'browser-image-compression';


const BRANCHES = ["CSE", "ECE", "ME", "Civil", "Chemical", "General Admin"];
const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [complaint, setComplaint] = useState('');
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [image, setImage] = useState<File | null>(null);

  // UI States
  const [status, setStatus] = useState('Idle');
  const [statusType, setStatusType] = useState<'normal' | 'error' | 'success'>('normal');
  const [isLoading, setIsLoading] = useState(false);

  // Crypto States
  const [finalProof, setFinalProof] = useState<string>('');
  const [rFactor, setRFactor] = useState<any>(null);
  const [showWarning, setShowWarning] = useState(false);
  useEffect(() => {
    // Check agar user ne is session me warning dekh li hai ya nahi
    const hasSeenWarning = sessionStorage.getItem("api_warning_seen");
    if (!hasSeenWarning) {
      setShowWarning(true); // First time show karo
    }
  }, []);
    useEffect(() => {
    if (finalProof) {
      setFinalProof(''); // Reset signature
      setStatus('⚠️ Text changed. Please Sign again.');
      setStatusType('normal');
    }
  }, [complaint]);

  // ✨ 2. Close Warning Function
  const handleCloseWarning = () => {
    sessionStorage.setItem("api_warning_seen", "true"); // Browser ko batao ki dekh liya
    setShowWarning(false);
  };

  // 1. STRICT LOGIN FUNCTION (college Only)
  const handleLogin = async () => {
    setStatus("Waiting for Google Login...");
    setStatusType('normal');
    setIsLoading(true); // Lock buttons
    
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;

      // 🛑 SECURITY CHECK: Domain Validation
      // if (!email || !email.endsWith('@acropolis.in')) {
      //   await signOut(auth); // Immediately kick out unauthorized user
      //   setUser(null);
      //   setStatus("❌ Access Denied: Only @acropolis.in emails are allowed!");
      //   setStatusType('error');
      //   setIsLoading(false);
      //   return; // Stop execution here
      // }

      // Agar domain sahi hai:
      setUser(result.user);
      setStatus("✅ Welcome! Logged in as: " + email);
      setStatusType('success');

    } catch (e: any) {
      // Handle Popup Close explicitly
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        setStatus("Login Cancelled by User.");
        setStatusType('normal');
      } else {
        console.error("Login Error:", e);
        setStatus("Login Failed: " + e.message);
        setStatusType('error');
      }
    } finally {
      setIsLoading(false); // Unlock buttons
    }
  };

  // 2. Sign (Get Ticket)
  const handleSign = async () => {
    if (!user) return alert("Please login first!");
    
    setStatus('🔐 Encrypting & Requesting Blind Signature...');
    setStatusType('normal');
    setIsLoading(true);
    
    try {
      const token = await user.getIdToken(); 
      const messageInt = messageToHashInt(complaint);
      const r = generateBlindingFactor();
      setRFactor(r);
      
      const blindedMessage = blindMessage(messageInt, r);
      
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          blinded_message: blindedMessage.toString(), 
          token: token 
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Signing Failed");

      const signature = unblindSignature(data.blinded_signature, r);
      setFinalProof(signature.toString());
      
      setStatus('✅ Signature Received! Your identity is now hidden.');
      setStatusType('success');
      
    } catch (e: any) {
      setStatus('❌ Signing Error: ' + e.message);
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Submit (Groq AI Check)
  const handleSubmit = async () => {
    if (isLoading) return;
    setStatus('🤖 AI Checking content for toxicity...');
    setStatus('📤 Uploading proof & checking content...');
    setStatusType('normal');
    setIsLoading(true);

   try {
      let imageString = null;

      // Agar image select ki hai, toh compress karke text banao
      if (image) {
        console.log("Original size:", image.size / 1024 / 1024, "MB");
        
        const options = {
          maxSizeMB: 0.8, // 1MB se kam rakhna zaroori hai Firestore ke liye
          maxWidthOrHeight: 1024,
          useWebWorker: true,
        };
        
        try {
          // Compress
          const compressedFile = await imageCompression(image, options);
          console.log("Compressed size:", compressedFile.size / 1024 / 1024, "MB");
          
          // Convert to Text (Base64)
          imageString = await convertToBase64(compressedFile);
        } catch (error) {
          console.error("Compression Error:", error);
          setStatus("❌ Image too large or invalid format.");
          setIsLoading(false);
          return;
        }
      }
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: complaint, signature: finalProof,branch: branch,imageUrl: imageString }),
      });

      const data = await res.json();

      if (!res.ok) {
        // AI Rejection Message here
        setStatus(`⛔ Blocked: ${data.error}`); 
        setStatusType('error');
      } else {
        setStatus(`✅ Success! Your Ticket ID: ${data.ticketId} (Save this!)`);
        setStatusType('success');
        setComplaint(''); // Clear form
        setFinalProof(''); // Reset proof
        setImage(null);// Reset image
        // Optional: Reset R factor if needed
      }

    } catch (e: any) {
      setStatus('❌ Network Error: ' + e.message);
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white font-sans">
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border-2 border-yellow-500 rounded-2xl p-6 max-w-md w-full shadow-2xl transform scale-100 animate-bounce-in">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">⚠️</span>
              <h2 className="text-xl font-bold text-yellow-400">Testing Mode Active</h2>
            </div>
            
            <div className="space-y-3 text-gray-300 text-sm mb-6">
              <p>
                Welcome to <span className="text-blue-400 font-bold">Whisper-Box</span> (Beta Version).
              </p>
              <p className="bg-yellow-900/30 p-3 rounded border-l-4 border-yellow-500">
                <strong className="text-yellow-200 block mb-1">NOTE: API Usage Limit</strong>
                We are using free-tier AI services. Please create complaints 
                <span className="text-white font-bold underline decoration-red-500 decoration-2 underline-offset-2 ml-1">ONLY for genuine testing</span>. 
                Excessive spamming may exhaust the API quota for others.
              </p>
              <ul className="list-disc pl-5 text-gray-400">
                <li>Don't click "Submit" repeatedly.</li>
                <li>Wait for the loading circle to finish.</li>
                <li>the website may include the minor bugs so take it easy</li>
              </ul>
            </div>

            <button 
              onClick={handleCloseWarning}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition transform active:scale-95"
            >
              I Understand, Continue to App
            </button>
          </div>
        </div>
      )}
      <h1 className="text-4xl font-bold mb-2 text-blue-400">Whisper-Box 🔒</h1>
      
      <div className="flex gap-6 mb-6 text-sm">
        <a href="/board" className="text-blue-300 hover:text-blue-100 underline hover:scale-105 transition">
          View Public Board &rarr;
        </a>
        <a href="/track" className="text-purple-300 hover:text-purple-100 underline hover:scale-105 transition">
          Track Your Complaint 🕵️‍♂️ &rarr;
        </a>
      </div>
      
      <p className="mb-8 text-gray-400">Acropolis Anonymous Grievance System</p>
      
      {/* Login Section */}
      {!user ? (
        <button 
          onClick={handleLogin}
          disabled={isLoading}
          className={`px-6 py-3 rounded font-bold flex items-center gap-2 transition
            ${isLoading ? 'bg-gray-600 cursor-wait' : 'bg-white text-gray-900 hover:bg-gray-200'}
          `}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G"/>
          {isLoading ? "Checking..." : "Sign in with Acropolis ID"}
        </button>
        <button
            onClick={() => router.push('/board')}
            className="text-gray-500 hover:text-white text-sm underline underline-offset-4 hover:scale-105 transition mt-2"
          >
            Are you a Board Member? Login Here
          </button>
      ) : (
        <div className="w-full max-w-lg">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-green-400 font-mono">User: {user.email}</span>
            <button 
              onClick={() => { signOut(auth); setUser(null); setStatus("Logged out"); setStatusType('normal'); }} 
              className="text-xs text-red-400 hover:text-red-300 underline"
            >
              Logout
            </button>
          </div>
          <label className="text-sm text-gray-400 mb-1 block">Select Department:</label>
           <select 
             value={branch}
             onChange={(e) => setBranch(e.target.value)}
             className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white mb-4 focus:border-blue-500 outline-none"
             disabled={!!finalProof || isLoading}
           >
             {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
           </select>

          <textarea
            className="w-full p-4 rounded bg-gray-800 border border-gray-700 text-white mb-4 focus:border-blue-500 outline-none transition disabled:opacity-50"
            rows={4}
            placeholder="Type your grievance here..."
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            disabled={!!finalProof || isLoading} 
          />
          <input 
                type="file" 
                accept="image/*"
                className="mb-4"
                onChange={(e) => { if (e.target.files?.[0]) setImage(e.target.files[0]); }}
            />

          <div className="flex gap-4">
            {/* BUTTON 1: GET SIGNATURE */}
            <button
              onClick={handleSign}
              disabled={!!finalProof || !complaint || isLoading}
              className={`flex-1 py-3 rounded font-bold transition 
                ${!!finalProof 
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                  : isLoading ? 'bg-blue-800 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
            >
              {isLoading && !finalProof ? "Processing..." : "1. Get Blind Signature"}
            </button>

            {/* BUTTON 2: SUBMIT */}
            {finalProof && (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className={`flex-1 py-3 rounded font-bold text-white transition animate-pulse
                  ${isLoading ? 'bg-green-800 cursor-wait' : 'bg-green-600 hover:bg-green-500'}`}
              >
                {isLoading ? "Analyzing..." : "2. Post to Board"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* STATUS BOX - Dynamic Colors */}
      <div className={`mt-8 p-4 border rounded w-full max-w-lg text-center transition-all duration-300
        ${statusType === 'error' ? 'border-red-500 bg-red-900/30' : 
          statusType === 'success' ? 'border-green-500 bg-green-900/30' : 
          'border-gray-600 bg-gray-800'}`}
      >
        <p className={`text-sm font-mono font-bold ${
          statusType === 'error' ? 'text-red-400' : 
          statusType === 'success' ? 'text-green-400' : 
          'text-yellow-400'
        }`}>
          STATUS: {status}
        </p>
      </div>
    </main>
  );
}
