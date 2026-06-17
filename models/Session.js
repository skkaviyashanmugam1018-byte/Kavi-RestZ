const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    phoneNumber:     { type: String, required: true, unique: true },
    state:           { type: String, default: "WELCOME" },
    cart:            { type: Array,  default: [] },
    deliveryData:    { type: mongoose.Schema.Types.Mixed, default: {} },
    deliveryStep:    { type: String, default: null },
    currentCategory: { type: String, default: null },
    pendingItem:     { type: mongoose.Schema.Types.Mixed, default: null },
    lastActivity:    { type: Date,   default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);