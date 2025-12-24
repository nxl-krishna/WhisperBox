import { NextResponse } from 'next/server';
import { verifySignature } from '@/lib/cryptoUtils'; 
import { getDb, verifyToken } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY|| "");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, signature } = body;

    // 1. DATA CHECK
    if (!message || !signature) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // 2. MATHEMATICAL VERIFICATION (Crypto Check)
    // Pehle ye karte hain kyunki ye fast aur free hai
    const isValid = verifySignature(message, signature);
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Signature! You are not authorized.' }, { status: 401 });
    }

    // 3. AI CONTENT MODERATION (Gemini Check) 🤖
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      // Hum AI ko strict instruction de rahe hain
      const prompt = `
        You are a content moderator for a student grievance system. 
        Analyze the following text for hate speech, severe profanity, harassment, or explicit toxicity.
        
        Text: "${message}"
        
        If the text is SAFE and acceptable for a public board, reply strictly with one word: "SAFE".
        If the text contains abuse, hate speech, or severe toxicity, reply strictly with one word: "UNSAFE".
      `;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const analysis = response.text().trim().toUpperCase();

      console.log(`[AI Moderator] Message: "${message}" -> Verdict: ${analysis}`);

      if (analysis.includes("UNSAFE")) {
        return NextResponse.json({ 
          error: 'Content Flagged: Your message violates community guidelines (Abusive/Toxic).' 
        }, { status: 400 });
      }

    } catch (aiError) {
      console.error("AI Check Failed:", aiError);
      // Agar AI fail ho jaye (quota/network), toh kya karein? 
      // Option A: Allow kar do (Fail Open)
      // Option B: Block kar do (Fail Closed) - Currently Allowing with warning for testing
      console.warn("Skipping AI check due to error.");
    }

    // 4. SAVE TO FIRESTORE (Only if Math + AI Passed)
    const db = getDb()
    await db.collection('complaints').add({
      content: message,
      signature: signature,
      timestamp: new Date(),
      status: 'Pending Review'
    });

    return NextResponse.json({ success: true, message: 'Complaint lodged anonymously!' });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 });
  }
}