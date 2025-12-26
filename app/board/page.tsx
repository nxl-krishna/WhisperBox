'use client';
import { useState, useEffect } from 'react';
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider, db } from "@/lib/firebaseClient"; 
import { collection, query, where, getDocs, orderBy, doc, updateDoc, arrayUnion, arrayRemove, increment } from "firebase/firestore";

const BRANCHES = ["CSE", "EE", "ME", "Civil", "Chemical", "General Admin"];

export default function Board() {
  const [user, setUser] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState("CSE");
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null); // To show loading on specific button

  // 1. Check Login on Load
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        if(u.email?.endsWith("@acropolis.in")) {
             setUser(u);
             fetchComplaints("CSE"); // Auto load CSE on login
        } else {
            alert("Only IITGN emails allowed");
            signOut(auth);
        }
      } else {
        setUser(null);
        setComplaints([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); }
  };

  // 2. Fetch Complaints (Sorted by Popularity 🔥)
  const fetchComplaints = async (branch: string) => {
    setLoading(true);
    setSelectedBranch(branch);
    try {
      const q = query(
        collection(db, "complaints"), 
        where("branch", "==", branch),
        orderBy("upvotes", "desc"), // 🔥 Sabse zyada votes wale upar
        orderBy("timestamp", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComplaints(data);
    } catch (e) {
      console.error("Fetch Error:", e);
      // Agar index error aaye console me, to link par click karna mat bhoolna!
    } finally {
      setLoading(false);
    }
  };

  // 3. Upvote Logic 🔼
  const handleUpvote = async (complaintId: string, currentUpvotes: number, upvotedBy: string[]) => {
    if (!user) return;
    setVotingId(complaintId); // Lock button

    const docRef = doc(db, "complaints", complaintId);
    const hasUpvoted = upvotedBy.includes(user.uid);

    try {
      if (hasUpvoted) {
        // Vote Wapas Lena (Remove)
        await updateDoc(docRef, {
          upvotes: increment(-1),
          upvotedBy: arrayRemove(user.uid)
        });
      } else {
        // Vote Dena (Add)
        await updateDoc(docRef, {
          upvotes: increment(1),
          upvotedBy: arrayUnion(user.uid)
        });
      }
      // UI Refresh (Optimistic Update bhi kar sakte ho, par ye safe hai)
      fetchComplaints(selectedBranch); 
    } catch (error) {
      console.error("Voting failed:", error);
      alert("Voting failed. Check console.");
    } finally {
      setVotingId(null);
    }
  };

  // 4. Access Block for Non-Logged In Users
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 text-center">
        <h1 className="text-4xl font-bold mb-4 text-blue-500">Public Grievance Board 📢</h1>
        <p className="mb-8 text-gray-400 max-w-md">
          View real-time issues raised by students. Login with your IITGN ID to view and upvote priority issues.
        </p>
        <button onClick={handleLogin} className="bg-white text-gray-900 px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition flex items-center gap-2">
           <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5"/>
           Login with IITGN ID
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-900 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-700 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">Student Voice 🗣️</h1>
          <p className="text-sm text-gray-400">Logged in as: <span className="text-green-400">{user.email}</span></p>
        </div>
        <div className="flex gap-4">
            <a href="/" className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 transition">➕ New Complaint</a>
            <button onClick={() => signOut(auth)} className="text-red-400 hover:text-red-300">Logout</button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
        {BRANCHES.map(b => (
          <button
            key={b}
            onClick={() => fetchComplaints(b)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition ${
              selectedBranch === b ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Complaints List */}
      {loading ? (
        <div className="flex justify-center mt-20"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {complaints.length === 0 ? (
            <p className="text-gray-500 col-span-full text-center mt-10">No complaints found for {selectedBranch}. Be the first to raise one!</p>
          ) : (
            complaints.map((c: any) => {
              const isUpvoted = c.upvotedBy?.includes(user.uid);
              
              return (
                <div key={c.id} className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col">
                  {/* Metadata */}
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-blue-900/50 text-blue-300 text-[10px] px-2 py-1 rounded border border-blue-800 uppercase tracking-wider">{c.branch}</span>
                    <span className="text-gray-500 text-xs">{new Date(c.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                  </div>

                  {/* Content */}
                  <p className="text-gray-200 text-lg mb-4 flex-grow font-light">"{c.content}"</p>

                  {/* Image Evidence */}
                  {c.imageUrl && (
                    <div className="mb-4 overflow-hidden rounded-lg border border-gray-600">
                      <img 
                        src={`data:image/png;base64,${c.imageUrl.split(',')[1]}`} // Handle Base64 prefix
                        alt="Evidence" 
                        className="w-full h-40 object-cover hover:scale-105 transition duration-300 cursor-pointer"
                        onClick={() => {
                             // Open Base64 in new tab
                             const win = window.open();
                             win?.document.write('<iframe src="' + c.imageUrl  + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
                        }}
                      />
                    </div>
                  )}

                  {/* Footer: Votes & Status */}
                  <div className="border-t border-gray-700 pt-4 flex justify-between items-center">
                    
                    {/* UPVOTE BUTTON */}
                    <button 
                        onClick={() => handleUpvote(c.id, c.upvotes || 0, c.upvotedBy || [])}
                        disabled={votingId === c.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                            isUpvoted 
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50' 
                            : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        {votingId === c.id ? (
                            <span className="animate-spin">⏳</span>
                        ) : (
                            <span>{isUpvoted ? '▲' : '△'}</span>
                        )}
                        <span className="font-bold">{c.upvotes || 0}</span>
                    </button>

                    <span className={`text-xs px-2 py-1 rounded font-mono ${
                        c.status === 'Resolved' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'
                    }`}>
                        {c.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}