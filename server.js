const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const webhookRoute = require("./routes/webhook");
const flowRoute    = require("./routes/flow");
const ordersRoute  = require("./routes/orders");

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── MongoDB ────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ── Routes ─────────────────────────────────────────────────
app.use("/webhook", webhookRoute);
app.use("/flow",    flowRoute);
app.use("/orders",  ordersRoute);

// ── Home ───────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("🍛 Kavi Chettinadu Restaurant Bot Running!");
});

// ── Privacy Policy ─────────────────────────────────────────
app.get("/privacy", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — Kavi Chettinadu Restaurant</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; line-height: 1.7; }
    h1   { color: #8B1A1A; border-bottom: 2px solid #8B1A1A; padding-bottom: 10px; }
    h2   { color: #8B1A1A; margin-top: 30px; }
    .header { background: #8B1A1A; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { color: white; border: none; }
    .header p  { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍛 Kavi Chettinadu Restaurant</h1>
    <p>📍 14/12A1, Kattupillaiyar Kovil Street, Hotel Arjuna Opposite, Rameswaram - 623526</p>
    <p>📞 +91-9585960612 | +91-9585960613</p>
  </div>

  <h1>Privacy Policy</h1>
  <p><strong>Last updated:</strong> June 2026</p>

  <h2>1. Information We Collect</h2>
  <p>When you place an order through our WhatsApp ordering system, we collect:</p>
  <ul>
    <li>Your name</li>
    <li>Phone number</li>
    <li>Delivery address</li>
    <li>Order details (items, quantities, preferences)</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <p>We use the information collected solely for:</p>
  <ul>
    <li>Processing and delivering your food orders</li>
    <li>Sending order confirmation and updates</li>
    <li>Contacting you regarding your order if needed</li>
  </ul>

  <h2>3. Data Sharing</h2>
  <p>We do <strong>not</strong> sell, trade, or share your personal information with any third parties. Your data is used exclusively for order fulfillment.</p>

  <h2>4. Data Retention</h2>
  <p>Order information is retained for a period necessary to fulfill the order and for basic record keeping. You may request deletion of your data at any time by contacting us.</p>

  <h2>5. WhatsApp Integration</h2>
  <p>Our ordering system uses the WhatsApp Business API. Messages sent through WhatsApp are subject to WhatsApp's own Privacy Policy in addition to ours.</p>

  <h2>6. Security</h2>
  <p>We take reasonable measures to protect your personal information from unauthorized access or disclosure.</p>

  <h2>7. Contact Us</h2>
  <p>If you have any questions about this Privacy Policy, please contact us:</p>
  <ul>
    <li>📞 Phone: +91-9585960612</li>
    <li>📍 Address: 14/12A1, Kattupillaiyar Kovil Street, Hotel Arjuna Opposite, Rameswaram - 623526</li>
  </ul>

  <p style="margin-top:40px;color:#888;font-size:13px">© 2026 Kavi Chettinadu Restaurant. All rights reserved.</p>
</body>
</html>`);
});

// ── Terms of Service ───────────────────────────────────────
app.get("/terms", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service — Kavi Chettinadu Restaurant</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; line-height: 1.7; }
    h1   { color: #8B1A1A; border-bottom: 2px solid #8B1A1A; padding-bottom: 10px; }
    h2   { color: #8B1A1A; margin-top: 30px; }
    .header { background: #8B1A1A; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { color: white; border: none; }
    .header p  { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍛 Kavi Chettinadu Restaurant</h1>
    <p>📍 14/12A1, Kattupillaiyar Kovil Street, Hotel Arjuna Opposite, Rameswaram - 623526</p>
    <p>📞 +91-9585960612 | +91-9585960613</p>
  </div>

  <h1>Terms of Service</h1>
  <p><strong>Last updated:</strong> June 2026</p>

  <h2>1. Ordering</h2>
  <p>By placing an order through our WhatsApp bot, you agree to provide accurate delivery information. Orders are confirmed only after you receive a confirmation message.</p>

  <h2>2. Delivery</h2>
  <p>We deliver within Rameswaram and nearby areas. Estimated delivery time is 30–45 minutes. Delivery times may vary during peak hours.</p>

  <h2>3. Payment</h2>
  <p>We accept Cash on Delivery (COD) and UPI payments. Payment must be made at the time of delivery for COD orders.</p>

  <h2>4. Cancellations</h2>
  <p>Orders can be cancelled within 5 minutes of placing. After that, cancellation may not be possible as preparation may have begun. Contact us at +91-9585960612 for cancellations.</p>

  <h2>5. Food Quality</h2>
  <p>We strive to maintain the highest quality. If you have any concerns about your order, please contact us immediately.</p>

  <h2>6. Contact Us</h2>
  <ul>
    <li>📞 Phone: +91-9585960612</li>
    <li>📍 Address: 14/12A1, Kattupillaiyar Kovil Street, Hotel Arjuna Opposite, Rameswaram - 623526</li>
  </ul>

  <p style="margin-top:40px;color:#888;font-size:13px">© 2026 Kavi Chettinadu Restaurant. All rights reserved.</p>
</body>
</html>`);
});

// ── 404 Handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));