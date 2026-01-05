import { NextResponse } from 'next/server';
import { verifySignature, messageToHashInt, KEYS } from '@/lib/cryptoUtils'; 
import { getDb } from '@/lib/firebaseAdmin';
import Groq from "groq-sdk"; // ✨ Import Groq
import bigInt from "big-integer";

// ✨ Initialize Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY 
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { message, signature, branch, imageUrl } = body;

    // 🧹 FIX: Trim whitespace
    message = message.trim();

    console.log("\n----- 🕵️ DEBUGGING SIGNATURE -----");
    console.log("1. Received Message:", `"${message}"`);

    // --- CRYPTO VERIFICATION ---
    const calculatedHash = messageToHashInt(message);
    const sigInt = bigInt(signature);
    const decryptedHash = sigInt.modPow(KEYS.e, KEYS.n);

    console.log("2. Backend Hash:", calculatedHash.toString().substring(0, 10));
    console.log("3. Signature Hash:", decryptedHash.toString().substring(0, 10));

    const isValid = calculatedHash.equals(decryptedHash);
    
    if (!isValid) {
      console.error("❌ Signature Mismatch!");
      return NextResponse.json({ 
        error: "Signature Mismatch! Don't edit text after signing." 
      }, { status: 401 });
    }

    // --- 🤖 AI TOXICITY CHECK (GROQ) ---
    console.log("🤖 Starting AI Check via Groq...");
    
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a strict content moderator for a college grievance portal.
            Rules:
            1. If the text contains hate speech, severe abuse, sexual harassment, or threats -> Reply ONLY "UNSAFE".
            2. If it is a genuine complaint, constructive criticism, or mild frustration -> Reply ONLY "SAFE".
            3. Do not provide explanations, just the single word.`
          },
          {
            role: "user",
            content: `Analyze this complaint: "${message}"`
          }
        ],
        model: "llama-3.3-70b-versatile", // ⚡ Super Fast Llama 3.3
        temperature: 0,
        max_tokens: 10,
      });

      const verdict = completion.choices[0]?.message?.content?.trim().toUpperCase() || "SAFE";
      console.log("🤖 AI Verdict:", verdict);

      if (verdict.includes("UNSAFE")) {
        console.warn("⛔ Complaint Rejected by Groq AI");
        return NextResponse.json({ error: "Message rejected: Toxic content detected." }, { status: 400 });
      }

    } catch (aiError: any) {
      console.error("❌ AI Check Failed:", aiError.message);
      // Fail-open: Agar AI down hai to complain jane do (Demo ke liye)
    }

    // --- SAVE TO DATABASE ---
    const ticketId = `#GRV-${Math.floor(1000 + Math.random() * 9000)}`;
    const db = getDb();
    
    await db.collection('complaints').add({
      ticketId,
      content: message,
      branch,
      signature,
      imageUrl: imageUrl || null, 
      timestamp: new Date(),
      status: 'Pending Review',
      adminReply: '',
      upvotes: 0,
      upvotedBy: [] 
    });

    return NextResponse.json({ success: true, ticketId });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
