'use client';
import { useState } from 'react';
import { db } from "@/lib/firebaseClient"; 
import { collection, query, where, getDocs } from "firebase/firestore";

export default function TrackStatus() {
  const [ticketId, setTicketId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e: any) => {
    e.preventDefault();
    if (!ticketId) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Search Firestore for this Ticket ID
      // Note: User exact ID (#GRV-1234) ya bina hash ke bhi daal sakta hai, handle kar lo
      const formattedId = ticketId.startsWith('#') ? ticketId : `#${ticketId}`;

      const q = query(collection(db, "complaints"), where("ticketId", "==", formattedId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        setResult(docData);
      } else {
        setError("❌ Invalid Ticket ID. Please check and try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Error fetching status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-8 text-blue-400">Track Complaint 🕵️‍♂️</h1>

      <div className="w-full max-w-md bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <form onSubmit={handleTrack} className="flex gap-2 mb-6">
          <input 
            type="text" 
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            placeholder="Enter Ticket ID (e.g. #GRV-1234)"
            className="flex-1 p-3 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none text-white"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="bg-blue-600 px-6 rounded font-bold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "..." : "Track"}
          </button>
        </form>

        {error && <p className="text-red-400 text-center">{error}</p>}

        {result && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <span className="text-gray-400 text-sm">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    result.status === 'Resolved' ? 'bg-green-900 text-green-400' : 
                    result.status === 'Rejected' ? 'bg-red-900 text-red-400' : 
                    'bg-yellow-900 text-yellow-400'
                }`}>
                    {result.status}
                </span>
            </div>

            <div className="mb-4">
                <p className="text-gray-400 text-xs mb-1">Your Grievance:</p>
                <p className="text-gray-200 italic">"{result.content}"</p>
            </div>

            {/* ✨ ADMIN REPLY SECTION */}
            {result.adminReply && (
                <div className="bg-blue-900/20 p-4 rounded border border-blue-500/30">
                    <p className="text-blue-400 text-xs font-bold mb-1">ADMIN RESPONSE:</p>
                    <p className="text-gray-200">"{result.adminReply}"</p>
                </div>
            )}
            
            {!result.adminReply && result.status !== 'Resolved' && (
                <p className="text-gray-500 text-xs text-center mt-4">No reply from admin yet.</p>
            )}
          </div>
        )}
      </div>

      <a href="/" className="mt-8 text-gray-500 hover:text-white transition">← Back to Home</a>
    </div>
  );
}