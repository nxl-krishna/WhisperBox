import { NextResponse } from 'next/server';
import { verifySignature, messageToHashInt, KEYS } from '@/lib/cryptoUtils'; 
import { getDb } from '@/lib/firebaseAdmin';
import bigInt from "big-integer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { message, signature, branch, imageUrl } = body;

    // 1. Basic Cleaning
    message = message.trim();
    console.log("📝 Demo Submission:", message.substring(0, 20) + "...");

    // 2. Crypto Verification (Isse mat hatana, ye core feature hai)
    const calculatedHash = messageToHashInt(message);
    const sigInt = bigInt(signature);
    const decryptedHash = sigInt.modPow(KEYS.e, KEYS.n);
    const isValid = calculatedHash.equals(decryptedHash);
    
    if (!isValid) {
      console.error("❌ Signature Mismatch");
      return NextResponse.json({ error: "Invalid Signature. Don't edit text after signing." }, { status: 401 });
    }

    // --- 3. AI CHECK (DEMO MODE: FAIL-OPEN) ---
    // Agar AI chalega toh badhiya, nahi chalega toh ignore karke aage badhenge.
    let aiPassed = true; // Default maan lo sab sahi hai

    if (process.env.GROQ_API_KEY) {
        console.log("🤖 Asking AI...");
        try {
            const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "Reply ONLY 'UNSAFE' if text contains severe hate speech. Else 'SAFE'." },
                        { role: "user", content: `Analyze: "${message}"` }
                    ],
                    max_tokens: 10
                })
            });

            if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                const verdict = aiData.choices[0]?.message?.content?.trim().toUpperCase() || "SAFE";
                console.log("🤖 Verdict:", verdict);

                if (verdict.includes("UNSAFE")) {
                    aiPassed = false; // Sirf tab roko jab AI explicitly mana kare
                }
            } else {
                console.warn("⚠️ AI API Error (Ignoring for Demo):", await aiResponse.text());
            }
        } catch (e) {
            console.warn("⚠️ AI Connection Failed (Ignoring for Demo)");
        }
    } else {
        console.warn("⚠️ No API Key found (Skipping AI Check)");
    }

    // Agar AI ne pakda hai toh block karo (Feature dikhane ke liye)
    if (!aiPassed) {
        return NextResponse.json({ error: "Message rejected: Toxic content detected." }, { status: 400 });
    }

    // --- 4. SAVE TO DB ---
    // Agar AI fail hua ya pass hua, code yahan aayega hi aayega (unless Toxic tha)
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
    console.error("Server Error:", error.message);
    return NextResponse.json({ error: "Submission Failed" }, { status: 500 });
  }
}
