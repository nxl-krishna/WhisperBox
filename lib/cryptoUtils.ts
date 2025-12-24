import bigInt from "big-integer";
import { sha256 } from "js-sha256";

// --- CENTRAL KEY STORE ---
// Yahan hum keys define karenge taaki pure project mein same rahein.

// Modulus (n)
const MODULUS_STR = "7980636771120090951467589380194874783439219283196738604218459111315142037046859310493855703706800122564801942452441448956660531709872949939420260631948333";

// Public Exponent (e)
const PUBLIC_EXP_STR = "65537";

// Private Exponent (d)
const PRIVATE_EXP_STR = "3971260911847786839636556828462017737118266311604315720291932626427963014971181792639487887977720568134114007086483523065319354071189431941371648269475441";
export const KEYS = {
  n: bigInt(MODULUS_STR),
  e: bigInt(PUBLIC_EXP_STR),
  d: bigInt(PRIVATE_EXP_STR) // Exporting d for Server use only
};

// --- HELPER FUNCTIONS ---

export const messageToHashInt = (message: string) => {
  const hashHex = sha256(message);
  return bigInt(hashHex, 16);
};

export const generateBlindingFactor = () => {
  let r;
  do {
    r = bigInt.randBetween(1, KEYS.n.minus(1));
  } while (bigInt.gcd(r, KEYS.n).notEquals(1));
  return r;
};

export const blindMessage = (messageInt: bigInt.BigInteger, r: bigInt.BigInteger) => {
  // m' = (m * r^e) % n
  const rPowE = r.modPow(KEYS.e, KEYS.n);
  return messageInt.multiply(rPowE).mod(KEYS.n);
};

export const unblindSignature = (blindedSignature: string, r: bigInt.BigInteger) => {
  const sPrime = bigInt(blindedSignature);
  // s = s' * r^(-1) % n
  const rInverse = r.modInv(KEYS.n);
  return sPrime.multiply(rInverse).mod(KEYS.n);
};

export const verifySignature = (message: string, signature: string) => {
  try {
    const messageHash = messageToHashInt(message);
    const sigInt = bigInt(signature);
    
    // Decrypt: signature^e % n
    const calculatedHash = sigInt.modPow(KEYS.e, KEYS.n);

    console.log("   -> [Verify] Expected Hash:", messageHash.toString().substring(0, 10));
    console.log("   -> [Verify] Decrypted Hash:", calculatedHash.toString().substring(0, 10));
    
    return calculatedHash.equals(messageHash);
  } catch (e) {
    console.error("Verification Crash:", e);
    return false;
  }
};