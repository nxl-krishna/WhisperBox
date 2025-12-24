const NodeRSA = require('node-rsa');
const bigInt = require('big-integer');

console.log("Generating 512-bit RSA Key Pair... (Wait karein)");

// 1. Generate Key
const key = new NodeRSA({ b: 512 });

// 2. Export Components
const components = key.exportKey('components');

// Helper function: Agar number hai to hex string banaye, agar buffer hai to buffer se hex banaye
const getHex = (val) => {
  if (Buffer.isBuffer(val)) {
    return val.toString('hex');
  } else {
    return val.toString(16); // Number ke liye radix 16 (hex) hota hai
  }
};

// 3. Convert to Decimal Strings (for big-integer)
const n = bigInt(getHex(components.n), 16).toString();
const e = bigInt(getHex(components.e), 16).toString();
const d = bigInt(getHex(components.d), 16).toString();

console.log("\n✅ KEYS GENERATED SUCCESSFULLY!\n");
console.log("Is niche diye hue code ko copy karke 'lib/cryptoUtils.ts' mein paste kar de:\n");
console.log("-------------------------------------------------------");
console.log(`// Modulus (n)
const MODULUS_STR = "${n}";

// Public Exponent (e)
const PUBLIC_EXP_STR = "${e}";

// Private Exponent (d)
const PRIVATE_EXP_STR = "${d}";`);
console.log("-------------------------------------------------------\n");