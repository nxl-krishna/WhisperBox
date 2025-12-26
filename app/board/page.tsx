'use client';
import { useState, useEffect } from 'react';
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider, db } from "@/lib/firebaseClient"; 
import { collection, query, where, getDocs, orderBy, doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc } from "firebase/firestore";

const BRANCHES = ["CSE", "EE", "ME", "Civil", "Chemical", "General Admin"];
// ✨ New: Status Options define kar liye
const STATUS_OPTIONS = ["Pending Review", "In Progress", "Resolved", "Rejected"];

export default function Board() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false); // ✨ New State to track Admin
  const [selectedBranch, setSelectedBranch] = useState("CSE");
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // For loading states on specific buttons

  // 1. Check Login & Admin Status on Load
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        // if(u.email?.endsWith("@iitgn.ac.in")) {
             setUser(u);
             await checkAdminStatus(u.email); // ✨ Check if user is Board Member
             fetchComplaints("CSE"); 
        // } else {
        //     alert("Only IITGN emails allowed");
        //     signOut(auth);
        // }
      } else {
        setUser(null);
        setIsAdmin(false);
        setComplaints([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); }
  };

  // ✨ New: Helper to check Admin Role
  const checkAdminStatus = async (email: string | null) => {
    if (!email) return;
    try {
      // Check if email exists in 'board_members' collection
      const q = query(collection(db, "board_members"), where("email", "==", email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setIsAdmin(true); // User is Admin!
        console.log("Welcome Board Member!");
      }
    } catch (e) {
      console.error("Admin Check Failed", e);
    }
  };

  // 2. Fetch Complaints
  const fetchComplaints = async (branch: string) => {
    setLoading(true);
    setSelectedBranch(branch);
    try {
      const q = query(
        collection(db, "complaints"), 
        where("branch", "==", branch),
        orderBy("upvotes", "desc"), 
        orderBy("timestamp", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComplaints(data);
    } catch (e) {
      console.error("Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  // 3. Upvote Logic (Same as before)
  const handleUpvote = async (complaintId: string, currentUpvotes: number, upvotedBy: string[]) => {
    if (!user) return;
    setActionLoading(complaintId); 

    const docRef = doc(db, "complaints", complaintId);
    const hasUpvoted = upvotedBy.includes(user.uid);

    try {
      if (hasUpvoted) {
        await updateDoc(docRef, { upvotes: increment(-1), upvotedBy: arrayRemove(user.uid) });
      } else {
        await updateDoc(docRef, { upvotes: increment(1), upvotedBy: arrayUnion(user.uid) });
      }
      fetchComplaints(selectedBranch); 
    } catch (error) { console.error(error); } 
    finally { setActionLoading(null); }
  };

  // ✨ 4. New: Handle Status Change (Admin Only)
  const handleStatusChange = async (complaintId: string, newStatus: string) => {
    if (!isAdmin) return; // Double security check
    
    // Optimistic Update (UI pe turant dikhao)
    const updatedList = complaints.map(c => 
        c.id === complaintId ? { ...c, status: newStatus } : c
    );
    setComplaints(updatedList);

    try {
        const docRef = doc(db, "complaints", complaintId);
        await updateDoc(docRef, { status: newStatus });
        console.log("Status Updated to", newStatus);
    } catch (error) {
        console.error("Status Update Failed:", error);
        alert("Failed to update status. Do you have permission?");
        fetchComplaints(selectedBranch); // Revert on error
    }
  };

  // Access Block
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 text-center">
        <h1 className="text-4xl font-bold mb-4 text-blue-500">Public Grievance Board 📢</h1>
        <button onClick={handleLogin} className="bg-white text-gray-900 px-8 py-3 rounded-full font-bold flex items-center gap-2 mx-auto">
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
          <h1 className="text-2xl font-bold text-blue-400">
            {isAdmin ? "Admin Dashboard 🛡️" : "Student Voice 🗣️"}
          </h1>
          <p className="text-sm text-gray-400">
            Logged in as: <span className="text-green-400">{user.email}</span>
            {isAdmin && <span className="ml-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded">BOARD MEMBER</span>}
          </p>
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
            <p className="text-gray-500 col-span-full text-center mt-10">No complaints found for {selectedBranch}.</p>
          ) : (
            complaints.map((c: any) => {
              const isUpvoted = c.upvotedBy?.includes(user.uid);
              
              // Dynamic Status Color
              let statusColor = "bg-yellow-900 text-yellow-400";
              if(c.status === "Resolved") statusColor = "bg-green-900 text-green-400";
              if(c.status === "Rejected") statusColor = "bg-red-900 text-red-400";
              if(c.status === "In Progress") statusColor = "bg-blue-900 text-blue-400";

              return (
                <div key={c.id} className={`bg-gray-800 p-6 rounded-xl border shadow-lg flex flex-col ${c.status === 'Resolved' ? 'border-green-500/30' : 'border-gray-700'}`}>
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
                        src={`data:image/png;base64,${c.imageUrl.split(',')[1]}`} 
                        alt="Evidence" 
                        className="w-full h-40 object-cover hover:scale-105 transition duration-300 cursor-pointer"
                        onClick={() => {
                             const win = window.open();
                             win?.document.write('<iframe src="' + c.imageUrl  + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
                        }}
                      />
                    </div>
                  )}

                  {/* Footer: Admin Controls or Status View */}
                  <div className="border-t border-gray-700 pt-4 flex justify-between items-center gap-4">
                    
                    {/* UPVOTE BUTTON */}
                    <button 
                        onClick={() => handleUpvote(c.id, c.upvotes || 0, c.upvotedBy || [])}
                        disabled={actionLoading === c.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                            isUpvoted 
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50' 
                            : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        <span>{isUpvoted ? '▲' : '△'}</span>
                        <span className="font-bold">{c.upvotes || 0}</span>
                    </button>

                    {/* ✨ ADMIN ONLY: STATUS DROPDOWN ✨ */}
                    {isAdmin ? (
                        <select 
                            value={c.status || "Pending Review"}
                            onChange={(e) => handleStatusChange(c.id, e.target.value)}
                            className={`text-xs px-2 py-1.5 rounded font-mono outline-none border border-gray-600 cursor-pointer ${statusColor}`}
                        >
                            {STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt} className="bg-gray-800 text-white">
                                    {opt}
                                </option>
                            ))}
                        </select>
                    ) : (
                        // Regular Student View (Badge Only)
                        <span className={`text-xs px-2 py-1 rounded font-mono ${statusColor}`}>
                            {c.status || "Pending Review"}
                        </span>
                    )}

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