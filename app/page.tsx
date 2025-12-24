'use client';
import { useState } from 'react';
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider } from "../lib/firebaseClient";
import { messageToHashInt, generateBlindingFactor, blindMessage, unblindSignature } from '@/lib/cryptoUtils';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [complaint, setComplaint] = useState('');
  const [status, setStatus] = useState('Idle');
  const [finalProof, setFinalProof] = useState<string>('');
  const [rFactor, setRFactor] = useState<any>(null);

  // 1. Login Function
  const handleLogin = async () => {
    // Button disable karne ke liye status set kar rahe hain
    setStatus("Opening Login Popup...");
    
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      setStatus("Logged in as: " + result.user.email);
    } catch (e: any) {
      // SPECIFIC ERROR HANDLING
      if (e.code === 'auth/cancelled-popup-request') {
        console.log("Login popup closed by user.");
        setStatus("Login cancelled. Try again.");
      } else if (e.code === 'auth/popup-closed-by-user') {
        console.log("Login popup closed manually.");
        setStatus("Login cancelled.");
      } else {
        console.error("Login Error:", e);
        setStatus("Login Failed: " + e.message);
      }
    }
  };

  // 2. Sign (Get Ticket) - Now sends Token!
  const handleSign = async () => {
    if (!user) return alert("Please login first!");
    setStatus('Blinding & Requesting Signature...');
    
    try {
      // Get fresh token from Firebase
      const token = await user.getIdToken(); 
      
      const messageInt = messageToHashInt(complaint);
      const r = generateBlindingFactor();
      setRFactor(r);
      
      const blindedMessage = blindMessage(messageInt, r);
      
      const res = await fetch('/api/sign', {
        method: 'POST',
        body: JSON.stringify({ 
          blinded_message: blindedMessage.toString(), 
          token: token // Sending token for verification
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      const signature = unblindSignature(data.blinded_signature, r);
      setFinalProof(signature.toString());
      setStatus('Success! You have a digital signature. You can now post anonymously.');
      
      // OPTIONAL: Logout user automatically to encourage anonymity for next step
      // signOut(auth); setUser(null); 

    } catch (e: any) {
      setStatus('Error: ' + e.message);
    }
  };

  // 3. Submit (Unchanged logic, but now pure anonymous)
  const handleSubmit = async () => {
    setStatus('Submitting Anonymously...');
    const res = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify({ message: complaint, signature: finalProof }),
    });

    if (res.ok) {
      setStatus('Complaint posted successfully! 🚀');
      setComplaint('');
      setFinalProof('');
    } else {
      setStatus('Submission Failed.');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white font-sans">
      <h1 className="text-4xl font-bold mb-2 text-blue-400">Whisper-Box 🔒</h1>
      <a href="/board" className="text-blue-300 hover:text-blue-100 underline text-sm">
    View Public Board &rarr;
  </a>
      <p className="mb-8 text-gray-400">IITGN Anonymous Grievance System</p>
      
      {/* Login Section */}
      {!user ? (
        <button 
  onClick={handleLogin}
  // Agar status "Opening..." hai, toh button disable rahega
  disabled={status.includes("Opening") || status.includes("Loading")}
  className={`bg-white text-gray-900 px-6 py-3 rounded font-bold flex items-center gap-2 
    ${status.includes("Opening") ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'}`}
>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6"/>
          Sign in with IITGN ID
        </button>
      ) : (
        <div className="w-full max-w-lg">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-green-400">Verified: {user.email}</span>
            <button onClick={() => { signOut(auth); setUser(null); }} className="text-xs text-red-400 hover:underline">Logout</button>
          </div>

          <textarea
            className="w-full p-4 rounded bg-gray-800 border border-gray-700 text-white mb-4 focus:border-blue-500 outline-none"
            rows={4}
            placeholder="Type your grievance here..."
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            disabled={!!finalProof}
          />

          <div className="flex gap-4">
            <button
              onClick={handleSign}
              disabled={!!finalProof || !complaint}
              className={`flex-1 py-3 rounded font-bold transition ${!!finalProof ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
              1. Get Blind Signature
            </button>

            {finalProof && (
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 bg-green-600 rounded hover:bg-green-500 font-bold transition animate-pulse"
              >
                2. Post to Board
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 border border-gray-700 rounded w-full max-w-lg text-center bg-gray-800">
        <p className="text-gray-300 text-sm">System Status: <span className="text-yellow-400 font-mono">{status}</span></p>
      </div>
    </main>
  );
}