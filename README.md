# 🔒 Whisper-Box: Anonymous Grievance Redressal System

> **A cryptographically secure platform for students to lodge complaints anonymously without fear of identity tracing.**

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange) ![Gemini AI](https://img.shields.io/badge/AI-Gemini_1.5_Flash-blue) ![Cryptography](https://img.shields.io/badge/Crypto-RSA_Blind_Signatures-green)

## 🧐 Problem Statement
In traditional feedback systems (Google Forms/Email), administrators can often trace the identity of a student via email or IP address. This leads to **fear of retaliation**, preventing honest feedback.

## 💡 The Solution: Blind Signatures
**Whisper-Box** uses the **RSA Blind Signature Protocol** (similar to digital cash schemes). 
1. The server validates that a user is a **"Valid Student"** (via IITGN Auth).
2. The server signs a **"Blinded"** (encrypted) token.
3. The server **never sees the actual message** during the signing phase.
4. The student **unblinds** the signature and posts the message to the public board.
5. The system verifies the signature proves validity, but **mathematically cannot link the message back to the student ID**.

---

## 🛠️ Tech Stack

* **Framework:** Next.js 14 (App Router)
* **Language:** TypeScript
* **Runtime:** Bun / Node.js
* **Database:** Firebase Firestore
* **Authentication:** Firebase Auth (Google Sign-In)
* **Cryptography:** `big-integer`, `node-rsa` (RSA-512 implementation)
* **AI Moderation:** Google Gemini API (`gemini-1.5-flash`)
* **Styling:** Tailwind CSS

---

## ⚙️ How It Works (The Protocol)

### Phase 1: The Blind Sign (Getting the Ticket)
1.  **Login:** User logs in with `@iitgn.ac.in` email.
2.  **Blinding:** Client generates a message hash ($m$) and a random factor ($r$).
    * Calculates $m' = (m \times r^e) \pmod n$
3.  **Signing:** Server checks if user has voted before. If not, signs $m'$ using Private Key ($d$).
    * $s' = (m')^d \pmod n$
4.  **Unblinding:** Client removes the random factor $r$ to get the valid signature $s$.
    * $s = s' \times r^{-1} \pmod n$

### Phase 2: The Anonymous Drop (Posting)
1.  **Submission:** User sends $(Message, s)$ to the public board API. **No Auth Token is sent.**
2.  **Verification:** Server verifies signature using Public Key ($e, n$).
    * Checks if $s^e \pmod n \equiv Hash(Message)$
3.  **AI Check:** Google Gemini scans text for abuse/toxicity.
4.  **Success:** Message is added to Firestore anonymously.

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/whisper-box.git](https://github.com/your-username/whisper-box.git)
cd whisper-box


3. Generate RSA Keys
This project requires a mathematically linked RSA Keypair. Run the generator script:

Bash

node generateKeys.js
Copy the output keys and paste them into lib/cryptoUtils.ts.

4. Environment Variables
Create a .env.local file in the root directory:

Code snippet

# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

# Firebase Admin (Secret - Service Account)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
# Ensure the private key is in a single line with \n
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"

# Google AI (Gemini)
GEMINI_API_KEY=your_gemini_api_key
5. Run Development Server
Bash

bun dev
Open http://localhost:3000 with your browser.

📂 Project Structure
Plaintext

├── app/
│   ├── api/
│   │   ├── sign/       # Phase 1: Auth check & Blind Signing
│   │   └── submit/     # Phase 2: Anonymous Verification & AI Check
│   ├── board/          # Public Grievance Display Board
│   └── page.tsx        # Frontend: Login & Voting Interface
├── lib/
│   ├── cryptoUtils.ts  # RSA Math (Blind, Unblind, Verify)
│   ├── firebaseAdmin.ts# Backend Admin SDK (Lazy Loaded)
│   └── firebaseClient.ts # Frontend Auth SDK
└── ...
🛡️ Security Features
Mathematical Anonymity: Even if the server database is leaked, no one can link a specific message to a specific user ID.

Sybil Attack Protection: Database tracks uid to ensure one student gets only one signature token.

AI Moderation: Prevents hate speech and abuse using Gemini 1.5 Flash.

Build-Safe Security: Lazy initialization of Firebase Admin to prevent build-time crashes on Vercel.

🤝 Contribution
Fork the repository.

Create a feature branch (git checkout -b feature-name).

Commit your changes (git commit -m 'Add some feature').

Push to the branch (git push origin feature-name).

Open a Pull Request.
