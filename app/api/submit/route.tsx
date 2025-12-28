import { NextResponse } from 'next/server';
import { verifySignature, messageToHashInt } from '@/lib/cryptoUtils'; 
import { getDb } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GROQ_API_KEY|| "YOUR_API_KEY"); 

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, signature, branch, imageUrl } = body;

    // --- 1. DEBUGGING LOGS ---
    console.log("----- DEBUGGING SUBMIT -----");
    console.log("Received Message:", message);
    console.log("Received Signature:", signature ? signature.substring(0, 20) + "..." : "null");

    // --- 2. CRYPTO VERIFICATION ---
    // Pehle message ko hash number mein convert karo
    const messageInt = messageToHashInt(message); 
    
    // 👇 FIX: .toString() add kiya kyunki verifySignature string maang raha hai
    const isValid = verifySignature(signature, messageInt.toString());
    
    console.log("Is Signature Valid?", isValid);

    if (!isValid) {
      console.error("❌ Signature Mismatch!");
      return NextResponse.json({ error: "Unauthorized: Invalid Token/Signature. Don't edit text after signing." }, { status: 401 });
    }

    // --- 3. AI TOXICITY CHECK (Gemini) ---
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Analyze this student complaint for severe toxicity, hate speech, or explicit abuse. 
      If it is safe/constructive criticism, reply "SAFE". 
      If it contains severe abuse, reply "UNSAFE".
      Complaint: "${message}"`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const verdict = response.text().trim().toUpperCase();

      if (verdict.includes("UNSAFE")) {
        return NextResponse.json({ error: "Message rejected by AI (Toxicity detected)" }, { status: 400 });
      }
    } catch (aiError) {
      console.error("AI Check Failed (Skipping):", aiError);
      // Fail-open: Agar AI down hai, toh message jaane do (Demo ke liye)
    }

    // --- 4. SAVE TO DATABASE ---
    const ticketId = `#GRV-${Math.floor(1000 + Math.random() * 9000)}`;
    const db = getDb();
    
    await db.collection('complaints').add({
      ticketId: ticketId,
      content: message,
      branch: branch,
      signature: signature,
      imageUrl: imageUrl || null, 
      timestamp: new Date(),
      status: 'Pending Review',
      adminReply: '',
      upvotes: 0,
      upvotedBy: [] 
    });

    return NextResponse.json({ 
        success: true, 
        message: 'Complaint lodged successfully!', 
        ticketId: ticketId 
    });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: 'Submission failed: ' + error.message }, { status: 500 });
  }
}
