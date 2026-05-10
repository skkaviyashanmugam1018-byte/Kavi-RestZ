require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/webhook", require("./routes/webhook"));
app.use("/api/orders", require("./routes/orders"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "WhatsApp Food Bot",
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/api/webhook`);
  console.log(`📊 Orders API: http://localhost:${PORT}/api/orders\n`);
});
