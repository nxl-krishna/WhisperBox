'use client';
import { useState, useEffect } from 'react';
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider, db } from "@/lib/firebaseClient"; 
import { collection, query, where, getDocs, orderBy, doc, updateDoc, arrayUnion, arrayRemove, increment } from "firebase/firestore";
// 📊 Chart Imports
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart Components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const BRANCHES = ["CSE", "ECE", "ME", "Civil", "Chemical", "General Admin"];
const STATUS_OPTIONS = ["Pending Review", "In Progress", "Resolved", "Rejected"];

export default function Board() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("CSE");
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // 📊 Analytics State
  const [stats, setStats] = useState<{[key: string]: number}>({ "Pending Review": 0, "In Progress": 0, "Resolved": 0, "Rejected": 0 });

  // 1. Check Login & Admin Status
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        // NOTE: Remove the comment below to enforce acropolis email restriction in production
        if(u.email?.endsWith("@acropolis.in")) {
             setUser(u);
             await checkAdminStatus(u.email); 
             fetchComplaints("CSE"); 
        } else {
           alert("Only acropolis emails allowed");
           signOut(auth);
        }
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

  const checkAdminStatus = async (email: string | null) => {
    if (!email) return;
    try {
      const q = query(collection(db, "board_members"), where("email", "==", email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) setIsAdmin(true);
    } catch (e) { console.error(e); }
  };

  // 2. Fetch Complaints & Calculate Stats
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

      // 📊 Calculate Stats for Chart (Only needed if Admin)
      const newStats: any = { "Pending Review": 0, "In Progress": 0, "Resolved": 0, "Rejected": 0 };
      data.forEach((c: any) => {
        const s = c.status || "Pending Review";
        if (newStats[s] !== undefined) newStats[s]++;
      });
      setStats(newStats);

    } catch (e) {
      console.error("Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  // 3. Upvote Logic
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

  // 4. ✨ Handle Admin Updates (Status & Reply)
  const handleAdminUpdate = async (complaintId: string, newStatus: string, newReply: string) => {
    if (!isAdmin) return;
    
    // Optimistic UI Update
    const updatedList = complaints.map(c => 
        c.id === complaintId ? { ...c, status: newStatus, adminReply: newReply } : c
    );
    setComplaints(updatedList);

    // Update Stats locally for immediate chart refresh
    // (Simplification: Just re-fetching is safer, but this is faster)
    
    try {
        const docRef = doc(db, "complaints", complaintId);
        await updateDoc(docRef, { 
            status: newStatus,
            adminReply: newReply
        });
        // Refresh to ensure stats sync
        fetchComplaints(selectedBranch);
    } catch (error) {
        console.error("Update Failed:", error);
        alert("Update failed.");
    }
  };

  // 📊 Chart Data Configuration
  const barChartData = {
    labels: Object.keys(stats),
    datasets: [{
      label: 'Complaints Status',
      data: Object.values(stats),
      backgroundColor: ['#F59E0B', '#3B82F6', '#10B981', '#EF4444'], // Yellow, Blue, Green, Red
    }]
  };

  // Access Block
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 text-center">
        <a 
          href="/" 
          className="absolute top-6 left-6 text-gray-400 hover:text-white hover:underline flex items-center gap-2 transition"
        >
          ← Back to Home
        </a>
        <h1 className="text-4xl font-bold mb-4 text-blue-500">Public Grievance Board 📢</h1>
        <button onClick={handleLogin} className="bg-white text-gray-900 px-8 py-3 rounded-full font-bold flex items-center gap-2 mx-auto hover:bg-gray-200 transition">
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
          <a href="/" className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition flex items-center gap-2">
              🏠 Home
            </a>
            <a href="/" className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 transition">➕ New Complaint</a>
            <button onClick={() => signOut(auth)} className="text-red-400 hover:text-red-300">Logout</button>
        </div>
      </div>

      {/* 📊 ANALYTICS SECTION (Admin Only) */}
      {isAdmin && !loading && (
        <div className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <h2 className="text-xl font-bold mb-4 text-purple-400">📊 {selectedBranch} Analytics</h2>
            <div className="h-64 w-full md:w-1/2 mx-auto">
                <Bar data={barChartData} options={{ maintainAspectRatio: false }} />
            </div>
        </div>
      )}

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
                  
                  {/* Metadata (Ticket ID & Date) */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col">
                        <span className="bg-blue-900/50 text-blue-300 text-[10px] px-2 py-1 rounded border border-blue-800 uppercase tracking-wider w-fit">{c.branch}</span>
                        <span className="text-xs text-gray-500 mt-1 font-mono">{c.ticketId || "#OLD-DATA"}</span>
                    </div>
                    <span className="text-gray-500 text-xs">{new Date(c.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                  </div>

                  {/* Content */}
                  <p className="text-gray-200 text-lg mb-4 flex-grow font-light">"{c.content}"</p>

                  {/* Image Evidence (Base64 Handling) */}
                  {c.imageUrl && (
                    <div className="mb-4 overflow-hidden rounded-lg border border-gray-600">
                      <img 
                        // Handle both old URLs and new Base64 strings
                        src={c.imageUrl.startsWith('http') ? c.imageUrl : `data:image/png;base64,${c.imageUrl.split(',')[1] || c.imageUrl}`} 
                        alt="Evidence" 
                        className="w-full h-40 object-cover hover:scale-105 transition duration-300 cursor-pointer"
                        onClick={() => {
                             const win = window.open();
                             win?.document.write('<iframe src="' + (c.imageUrl.startsWith('http') ? c.imageUrl : `data:image/png;base64,${c.imageUrl.split(',')[1] || c.imageUrl}`) + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
                        }}
                      />
                    </div>
                  )}

                  {/* Footer Logic: ADMIN vs STUDENT */}
                  {isAdmin ? (
                    <div className="mt-4 pt-4 border-t border-gray-700 bg-gray-900/30 p-3 rounded">
                        <label className="text-xs text-purple-400 font-bold block mb-2">🛡️ Admin Controls:</label>
                        
                        {/* 1. Status Dropdown */}
                        <select 
                            value={c.status || "Pending Review"}
                            onChange={(e) => handleAdminUpdate(c.id, e.target.value, c.adminReply || "")}
                            className={`w-full text-sm p-2 rounded border border-gray-600 mb-3 outline-none cursor-pointer ${statusColor.replace('text-', 'text-white ')}`}
                        >
                            {STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt} className="bg-gray-800 text-white">{opt}</option>
                            ))}
                        </select>

                        {/* 2. Admin Reply Input */}
                        <input 
                            type="text"
                            defaultValue={c.adminReply || ""}
                            onBlur={(e) => handleAdminUpdate(c.id, c.status, e.target.value)}
                            placeholder="Type reply to student..."
                            className="w-full bg-gray-800 text-white text-sm p-2 rounded border border-gray-600 focus:border-blue-500 outline-none"
                        />
                        <p className="text-[10px] text-gray-500 mt-1 text-right">*Click outside to save reply</p>
                    </div>
                  ) : (
                    // STUDENT VIEW
                    <div className="border-t border-gray-700 pt-4">
                        <div className="flex justify-between items-center gap-4">
                            {/* Upvote Button */}
                            <button 
                                onClick={() => handleUpvote(c.id, c.upvotes || 0, c.upvotedBy || [])}
                                disabled={actionLoading === c.id}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                                    isUpvoted ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                <span>{isUpvoted ? '▲' : '△'}</span>
                                <span className="font-bold">{c.upvotes || 0}</span>
                            </button>

                            {/* Status Badge */}
                            <span className={`text-xs px-2 py-1 rounded font-mono ${statusColor}`}>
                                {c.status || "Pending Review"}
                            </span>
                        </div>

                        {/* Admin Reply Display */}
                        {c.adminReply && (
                            <div className="mt-3 text-xs bg-blue-900/20 p-3 rounded border-l-2 border-blue-500">
                                <span className="font-bold text-blue-400 block mb-1">Admin Response:</span> 
                                <span className="text-gray-300">"{c.adminReply}"</span>
                            </div>
                        )}
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      )}
      <a href="/" className="mt-8 text-gray-500 hover:text-white transition">← Back to Home</a>
    </div>
  );
}