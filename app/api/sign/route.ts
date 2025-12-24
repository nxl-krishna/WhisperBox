import { NextResponse } from 'next/server';
import bigInt from "big-integer";
import { db } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';
import { KEYS } from '@/lib/cryptoUtils'; // Centralized Keys import

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { blinded_message, token } = body;

    // 1. BASIC VALIDATION
    if (!blinded_message || !token) {
      return NextResponse.json({ error: 'Missing data: Token or Blinded Message missing' }, { status: 400 });
    }

    // 2. VERIFY FIREBASE TOKEN (Authentication)
    // Ye confirm karta hai ki request kisi valid logged-in user se aayi hai.
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (authError) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    // Optional: Check Domain (Restrict to IITGN)
    /*
    if (!userEmail?.endsWith('@iitgn.ac.in')) {
       return NextResponse.json({ error: 'Only IITGN students allowed.' }, { status: 403 });
    }
    */

    // 3. PREVENT DOUBLE VOTING (Database Check)
    const userRef = db.collection('voters').doc(userId);
    const userDoc = await userRef.get();

    /* NOTE FOR TESTING: 
       Agar testing karte waqt "You have already generated a signature token" error aaye,
       toh niche wale if-block ko comment out kar dena, ya Firebase Console se user doc delete kar dena.
    */
    if (userDoc.exists) {
        return NextResponse.json({ error: 'You have already generated a signature token.' }, { status: 403 });
    }

    // 4. SIGNING LOGIC (The Core Crypto)
    const mPrime = bigInt(blinded_message);

    // Debugging Log to ensure keys match
    console.log(`[Signer] Signing for user: ${userEmail}`);
    console.log(`[Signer] Using Private Key (d) ending in: ...${KEYS.d.toString().slice(-5)}`);

    // RSA Signature: s' = (m')^d % n
    const blindedSignature = mPrime.modPow(KEYS.d, KEYS.n);

    // 5. MARK USER AS "SERVED"
    // Hum record kar rahe hain ki is user ne signature le liya hai.
    // Hum Message CONTENT save nahi kar rahe, sirf ye ki "Isne ek baar sign karwa liya".
    await userRef.set({
        email: userEmail, // Storing email just for admin tracking (optional)
        timestamp: new Date(),
        status: 'Token Issued'
    });

    // 6. RETURN BLINDED SIGNATURE
    return NextResponse.json({ 
      blinded_signature: blindedSignature.toString() 
    });

  } catch (error: any) {
    console.error("❌ Sign API Error:", error);
    return NextResponse.json({ error: error.message || 'Signing process failed' }, { status: 500 });
  }
}