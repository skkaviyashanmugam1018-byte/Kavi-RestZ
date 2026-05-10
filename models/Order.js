const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      default: () =>
        "ORD" +
        Date.now().toString().slice(-6) +
        Math.random().toString(36).substring(2, 5).toUpperCase(),
    },
    phoneNumber: { type: String, required: true },
    items: [
      {
        itemId:   String,
        name:     String,
        price:    Number,
        quantity: Number,
        category: String,
      },
    ],
    totalAmount: { type: Number, required: true },
    deliveryDetails: {
      name:    { type: String, default: "" },
      phone:   { type: String, default: "" },
      address: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "preparing", "delivered", "cancelled"],
      default: "confirmed",
    },
    estimatedDelivery: { type: Number, default: 30 }, // minutes
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);