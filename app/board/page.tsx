'use client';
import { useState, useEffect } from 'react';
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider, db } from "@/lib/firebaseClient"; // Ensure db is exported from firebaseClient
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

const BRANCHES = ["CSE", "EE", "ME", "Civil", "Chemical", "General Admin"];

export default function Board() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("CSE");
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 1. Login & Admin Check
  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;
      
      // Check Firestore if this email is a Board Member
      const q = query(collection(db, "board_members"), where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setUser(result.user);
        setIsAdmin(true);
        fetchComplaints("CSE"); // Default load CSE
      } else {
        await signOut(auth);
        setError("⛔ Access Denied: You are not a Board Member.");
      }
    } catch (e: any) {
      console.error(e);
      setError("Login Error");
    }
  };

  // 2. Fetch Complaints based on Branch
  const fetchComplaints = async (branch: string) => {
    setLoading(true);
    setSelectedBranch(branch);
    try {
      const q = query(
        collection(db, "complaints"), 
        where("branch", "==", branch),
        orderBy("timestamp", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComplaints(data);
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
        <h1 className="text-3xl font-bold mb-4 text-red-500">Restricted Area 🚧</h1>
        <p className="mb-6 text-gray-400">Only Board Members can access this dashboard.</p>
        
        {error && <p className="text-red-400 bg-red-900/20 p-2 rounded mb-4">{error}</p>}
        
        <button onClick={handleLogin} className="bg-white text-black px-6 py-2 rounded font-bold hover:bg-gray-200">
          Board Member Login
        </button>
        <a href="/" className="mt-8 text-blue-400 underline">Back to Home</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-900 text-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">Board Dashboard 🛡️</h1>
          <p className="text-sm text-green-400">Welcome, {user.email}</p>
        </div>
        <button onClick={() => { signOut(auth); setUser(null); setIsAdmin(false); }} className="text-red-400 border border-red-400 px-3 py-1 rounded hover:bg-red-900/20">
          Logout
        </button>
      </div>

      {/* Filter Section */}
      <div className="flex gap-4 items-center mb-6">
        <label className="text-gray-300">Filter by Branch:</label>
        <div className="flex gap-2">
          {BRANCHES.map(b => (
            <button
              key={b}
              onClick={() => fetchComplaints(b)}
              className={`px-4 py-2 rounded text-sm font-bold transition ${
                selectedBranch === b ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Complaints Grid */}
      {loading ? (
        <p className="text-center text-yellow-400 animate-pulse">Fetching records...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {complaints.length === 0 ? (
            <p className="text-gray-500">No complaints found for {selectedBranch}.</p>
          ) : (
            complaints.map((c: any) => (
              <div key={c.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded uppercase">{c.branch}</span>
                  <span className="text-gray-500 text-xs">{new Date(c.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                </div>
                <p className="text-gray-200 text-lg mb-4">"{c.content}"</p>
                <div className="border-t border-gray-700 pt-4 mt-2">
                  <p className="text-xs text-gray-500 font-mono break-all">
                    <span className="text-green-500">Signature:</span> {c.signature.substring(0, 20)}...
                  </p>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-xs text-yellow-500 bg-yellow-900/20 px-2 py-1 rounded">{c.status}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}