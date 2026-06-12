require('dotenv').config();
const fs = require('fs');
const https = require('https');

const PHONE_NUMBER_ID = "1208355402355410";
const ACCESS_TOKEN = process.env.WHATSAPP_API_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("❌ WHATSAPP_API_TOKEN not found in .env file!");
  process.exit(1);
}

const publicKey = fs.readFileSync('./public.pem', 'utf8').trim();
console.log("✅ Public key loaded!");
console.log("📋 Phone Number ID:", PHONE_NUMBER_ID);

const postData = JSON.stringify({ business_public_key: publicKey });

const options = {
  hostname: 'graph.facebook.com',
  path: `/v19.0/${PHONE_NUMBER_ID}/whatsapp_business_encryption`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log("🚀 Uploading public key to Meta...");

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      if (response.success) {
        console.log("✅ SUCCESS! Public key uploaded!");
      } else {
        console.error("❌ Error:", response.error.message);
        console.error("Error Type:", response.error.type);
      }
    } catch (e) {
      console.log("Response:", body);
    }
  });
});

req.on('error', (e) => console.error("❌ Network Error:", e.message));
req.write(postData);
req.end();