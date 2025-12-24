import { db } from '@/lib/firebaseAdmin';

// Next.js ko bolo ki ye page har request pe fresh data laye (No Caching)
export const dynamic = 'force-dynamic';

async function getComplaints() {
  try {
    // Admin SDK se data fetch kar rahe hain
    const snapshot = await db.collection('complaints')
      .orderBy('timestamp', 'desc') // Newest first
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching complaints:", error);
    return [];
  }
}

export default async function BoardPage() {
  const complaints = await getComplaints();

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-400">📢 Public Notice Board</h1>
          <a href="/" className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition">
            ← Back to Voting
          </a>
        </div>

        {complaints.length === 0 ? (
          <p className="text-center text-gray-500 mt-20">No complaints posted yet. Be the first!</p>
        ) : (
          <div className="grid gap-6">
            {complaints.map((item: any) => (
              <div key={item.id} className="bg-gray-800 border border-gray-700 p-6 rounded-lg shadow-lg hover:border-blue-500 transition">
                
                {/* Anonymous Identity Header */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center font-bold text-xs">
                    ?
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-300">Anonymous Student</p>
                    <p className="text-xs text-gray-500">
                      {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleString() : 'Just now'}
                    </p>
                  </div>
                </div>

                {/* The Complaint Message */}
                <p className="text-lg text-white mb-4 leading-relaxed">
                  {item.content}
                </p>

                {/* The Proof Section (Verification) */}
                <div className="bg-gray-900 p-3 rounded border border-gray-700 overflow-hidden">
                  <p className="text-xs text-green-400 font-mono mb-1">✓ Verified via RSA Blind Signature</p>
                  <p className="text-[10px] text-gray-600 font-mono break-all truncate">
                    Sig: {item.signature}
                  </p>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}