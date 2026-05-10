const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  itemId:   String,
  name:     String,
  price:    Number,
  quantity: { type: Number, default: 1 },
  category: String,
});

const sessionSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, required: true, unique: true },
    state: {
      type: String,
      enum: [
        "WELCOME",
        "MAIN_MENU",
        "CATEGORY_MENU",
        "ITEM_MENU",
        "CART",
        "COLLECT_DETAILS",
        "SELECT_PAYMENT",  // ✅ Added
        "CONFIRM_UPI",     // ✅ Added
        "ORDER_PLACED",
        "CONTACT",
      ],
      default: "WELCOME",
    },
    currentCategory: { type: String, default: null },
    cart: [cartItemSchema],

    // Delivery detail collection
    deliveryStep: {
      type: String,
      enum: [null, "name", "phone", "address", "pincode"],
      default: null,
    },
    deliveryData: {
      name:    { type: String, default: "" },
      phone:   { type: String, default: "" },
      address: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },

    // ✅ Added — payment method tracking
    paymentMethod: {
      type: String,
      enum: [null, "COD", "UPI"],
      default: null,
    },

    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

sessionSchema.methods.getCartTotal = function () {
  return this.cart.reduce((total, item) => total + item.price * item.quantity, 0);
};

sessionSchema.methods.clearCart = function () {
  this.cart = [];
};

module.exports = mongoose.model("Session", sessionSchema);