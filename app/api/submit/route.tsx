import { NextResponse } from 'next/server';
import { verifySignature, messageToHashInt, KEYS } from '@/lib/cryptoUtils'; // KEYS bhi import karo debug ke liye
import { getDb } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from "@google/generative-ai";
import bigInt from "big-integer";

const genAI = new GoogleGenerativeAI(process.env.GROQ_API_KEY || "YOUR_API_KEY"); 

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { message, signature, branch, imageUrl } = body;

    // 🧹 FIX 1: Trim whitespace (Sabse important)
    message = message.trim();

    console.log("\n----- 🕵️ DEBUGGING SIGNATURE -----");
    console.log("1. Received Message:", `"${message}"`); // Quotes me print karo taaki space dikhe
    
    // --- DEEP DEBUGGING ---
    const calculatedHash = messageToHashInt(message);
    const sigInt = bigInt(signature);
    const decryptedHash = sigInt.modPow(KEYS.e, KEYS.n);

    console.log("2. Backend Calculated Hash:", calculatedHash.toString().substring(0, 10) + "...");
    console.log("3. Signature Decrypted Hash:", decryptedHash.toString().substring(0, 10) + "...");

    // Agar ye dono Hash alag hain, toh Signature fail hoga
    const isValid = calculatedHash.equals(decryptedHash);
    console.log("4. IS VALID?", isValid);
    console.log("----------------------------------\n");

    if (!isValid) {
      return NextResponse.json({ 
        error: `Signature Mismatch! Backend Hash: ${calculatedHash.toString().substring(0,5)}... vs Sig Hash: ${decryptedHash.toString().substring(0,5)}...` 
      }, { status: 401 });
    }

    // --- 3. AI TOXICITY CHECK ---
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Analyze: "${message}". Reply SAFE or UNSAFE (hate speech/abuse).`;
      const result = await model.generateContent(prompt);
      const verdict = result.response.text().trim().toUpperCase();

      if (verdict.includes("UNSAFE")) {
        return NextResponse.json({ error: "Message rejected by AI (Toxicity detected)" }, { status: 400 });
      }
    } catch (aiError) {
      console.log("AI Check Skipped (Demo Mode)");
    }

    // --- 4. SAVE TO DB ---
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
