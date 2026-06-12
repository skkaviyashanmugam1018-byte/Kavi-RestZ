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
    h1 { color: #8B1A1A; border-bottom: 2px solid #8B1A1A; padding-bottom: 10px; }
    h2 { color: #8B1A1A; margin-top: 30px; }
    .header { background: #8B1A1A; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { color: white; border: none; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍛 Kavi Chettinadu Restaurant</h1>
    <p>📍 14/12A1, Kattupillaiyar Kovil Street, Rameswaram - 623526</p>
    <p>📞 +91-9585960612 | +91-9585960613</p>
  </div>
  <h1>Privacy Policy</h1>
  <p><strong>Last updated:</strong> June 2026</p>
  <h2>1. Information We Collect</h2>
  <p>We collect your name, phone number, and delivery address solely for processing food orders.</p>
  <h2>2. How We Use Your Information</h2>
  <p>Your information is used only for order processing, delivery, and order-related communication.</p>
  <h2>3. Data Sharing</h2>
  <p>We do <strong>not</strong> sell or share your personal information with any third parties.</p>
  <h2>4. Contact Us</h2>
  <p>📞 +91-9585960612 | 📍 Kattupillaiyar Kovil Street, Rameswaram - 623526</p>
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
  <title>Terms of Service — Kavi Chettinadu Restaurant</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; line-height: 1.7; }
    h1 { color: #8B1A1A; }
    h2 { color: #8B1A1A; margin-top: 30px; }
    .header { background: #8B1A1A; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { color: white; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍛 Kavi Chettinadu Restaurant</h1>
    <p>📍 14/12A1, Kattupillaiyar Kovil Street, Rameswaram - 623526</p>
  </div>
  <h1>Terms of Service</h1>
  <p><strong>Last updated:</strong> June 2026</p>
  <h2>1. Ordering</h2>
  <p>By placing an order through our WhatsApp bot, you agree to provide accurate delivery information.</p>
  <h2>2. Delivery</h2>
  <p>We deliver within Rameswaram. Estimated delivery time: 30–45 minutes.</p>
  <h2>3. Payment</h2>
  <p>We accept Cash on Delivery, UPI, and Card payments.</p>
  <h2>4. Cancellations</h2>
  <p>Orders can be cancelled within 5 minutes. Contact: +91-9585960612</p>
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