const NodeRSA = require('node-rsa');
const key = new NodeRSA({ b: 512 });

console.log("PRIVATE_KEY:", JSON.stringify(key.exportKey('private')));
console.log("PUBLIC_KEY:", JSON.stringify(key.exportKey('public')));
