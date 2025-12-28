import bigInt from "big-integer";
import { sha256 } from "js-sha256";

// --- 1. KEY MANAGEMENT (Env Vars + Fallback) ---

// Fallback Keys (Tumhari generated keys - Demo ke liye)
const FALLBACK_MODULUS = "7980636771120090951467589380194874783439219283196738604218459111315142037046859310493855703706800122564801942452441448956660531709872949939420260631948333";
const FALLBACK_EXPONENT = "65537";
const FALLBACK_PRIVATE = "3971260911847786839636556828462017737118266311604315720291932626427963014971181792639487887977720568134114007086483523065319354071189431941371648269475441";

// Logic: Pehle Environment Variables check karo, nahi toh Fallback use karo
const MODULUS_STR = process.env.NEXT_PUBLIC_RSA_MODULUS || FALLBACK_MODULUS;
const PUBLIC_EXP_STR = process.env.NEXT_PUBLIC_RSA_EXPONENT || FALLBACK_EXPONENT;
const PRIVATE_EXP_STR = process.env.RSA_PRIVATE_KEY_D || FALLBACK_PRIVATE;

export const KEYS = {
  n: bigInt(MODULUS_STR),
  e: bigInt(PUBLIC_EXP_STR),
  d: bigInt(PRIVATE_EXP_STR) // Note: Client side pe ye expose nahi hona chahiye ideally
};

// --- 2. HELPER FUNCTIONS ---

// Message -> SHA256 Hash -> BigInteger
export const messageToHashInt = (message: string) => {
  const hashHex = sha256(message);
  return bigInt(hashHex, 16);
};

// Generate Random 'r' (Blinding Factor)
export const generateBlindingFactor = () => {
  let r;
  do {
    // Generate random number between 1 and n-1
    r = bigInt.randBetween(1, KEYS.n.minus(1));
  } while (bigInt.gcd(r, KEYS.n).notEquals(1)); // Ensure gcd(r, n) == 1
  return r;
};

// Step 1: Client Blinds the Message
// m' = (m * r^e) % n
export const blindMessage = (messageInt: bigInt.BigInteger, r: bigInt.BigInteger) => {
  const rPowE = r.modPow(KEYS.e, KEYS.n);
  return messageInt.multiply(rPowE).mod(KEYS.n);
};

// Step 2: Server Signs (Done in /api/sign)
// s' = (m')^d % n (Yeh function API route me manually hota hai usually)

// Step 3: Client Unblinds the Signature
// s = s' * r^(-1) % n
export const unblindSignature = (blindedSignature: string, r: bigInt.BigInteger) => {
  const sPrime = bigInt(blindedSignature);
  const rInverse = r.modInv(KEYS.n);
  return sPrime.multiply(rInverse).mod(KEYS.n);
};

// --- 3. VERIFICATION FUNCTION (Crucial for API) ---

// Verify: s^e % n == Hash(m)
export const verifySignature = (message: string, signature: string) => {
  try {
    // 1. Calculate Expected Hash from the original text
    const messageHash = messageToHashInt(message);
    
    // 2. Parse Signature
    const sigInt = bigInt(signature);
    
    // 3. Decrypt Signature: (s^e) % n
    // Ye step check karta hai ki kya ye signature humari Private Key se hi sign hua tha?
    const calculatedHash = sigInt.modPow(KEYS.e, KEYS.n);

    // Debugging Logs (Vercel logs me dikhenge)
    console.log("   -> [Verify] Message Hash:", messageHash.toString().substring(0, 10) + "...");
    console.log("   -> [Verify] Decrypted Sig:", calculatedHash.toString().substring(0, 10) + "...");
    
    // 4. Compare
    return calculatedHash.equals(messageHash);
  } catch (e) {
    console.error("Verification Crash:", e);
    return false;
  }
};
