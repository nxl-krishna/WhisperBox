// app/api/submit/route.ts
import { NextResponse } from 'next/server';
import { verifySignature } from '@/lib/cryptoUtils'; 
import { getDb } from '@/lib/firebaseAdmin';
import Groq from "groq-sdk";

// Initialize Groq
const groq = new Groq({ apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, signature,branch } = body;

    // 1. DATA CHECK
    if (!message || !signature || !branch) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // 2. CRYPTO CHECK
    const isValid = verifySignature(message, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Signature!' }, { status: 401 });
    }

    // 3. AI MODERATION (USING GROQ / LLAMA 3) 🚀
    let analysis = "SAFE";
    
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a content moderator. Check the text for hate speech, severe profanity, or toxicity. Reply STRICTLY with 'SAFE' or 'UNSAFE'."
          },
          {
            role: "user",
            content: message,
          },
        ],
        model: "llama-3.3-70b-versatile", // Super fast & Free tier friendly
      });

      analysis = completion.choices[0]?.message?.content?.trim().toUpperCase() || "SAFE";
      console.log(`[Groq AI] Verdict: ${analysis}`);
      // app/api/submit/route.tsx

    if (analysis.includes("UNSAFE")) {
      return NextResponse.json({ 
        // Ye message frontend pe dikhega 👇
        error: '⚠️ Request Rejected: Abusive language or toxic content is not allowed.' 
      }, { status: 400 });
    }

    } catch (aiError) {
      console.error("Groq Check Failed:", aiError);
      // Fail Open: Agar API fail hui to allow kar do temporarily
    }

    if (analysis.includes("UNSAFE")) {
      return NextResponse.json({ error: 'Content Flagged: Toxic content detected.' }, { status: 400 });
    }

    // 4. SAVE TO DB
    const db = getDb();
    await db.collection('complaints').add({
      content: message,
      signature: signature,
      branch: branch,
      timestamp: new Date(),
      status: 'Pending Review',
      aiProvider: 'Groq'
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 });
  }
}