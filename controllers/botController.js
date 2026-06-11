const Session  = require("../models/Session");
const Order    = require("../models/Order");
const MENU     = require("../config/menu");
const CATALOGUE_MAP = require("../config/catalogue");
const axios    = require("axios");
const {
  sendText,
  sendButtons,
  sendList,
  sendImage,
  sendCatalogueMessage,
  sendOrderFlow,          // ← புது function
  sendOrderConfirmation,
} = require("../config/whatsapp");

// ─────────────────────────────────────────────────────────────
// Welcome Message
// ─────────────────────────────────────────────────────────────
const buildWelcomeMessage = () =>
  `🍽️ *Welcome to ${process.env.RESTAURANT_NAME || "Kavi Chettinadu Restaurant"}!* 🍽️\n\n_Taste The Tradition_ ✨\n\nAuthentic Chettinadu flavours from the heart of Rameswaram!\n\nHow can we help you today?`;

// ─────────────────────────────────────────────────────────────
// Cart Message
// ─────────────────────────────────────────────────────────────
const buildCartMessage = (cart) => {
  if (!cart || cart.length === 0)
    return "🛒 Your cart is empty.\n\nBrowse our menu to add items!";

  let msg = "🛒 *Your Cart*\n─────────────────\n";
  cart.forEach((item, i) => {
    msg += `${i + 1}. ${item.name}\n   ${item.quantity} × ₹${item.price} = ₹${item.price * item.quantity}\n`;
  });
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  msg += `─────────────────\n💰 *Total: ₹${total}*`;
  return msg;
};

// ─────────────────────────────────────────────────────────────
// Contact Message
// ─────────────────────────────────────────────────────────────
const buildContactMessage = () =>
  `📍 *Contact & Location*\n\n🏠 *Address:*\n${process.env.RESTAURANT_ADDRESS || "14/12A1, Rameswaram - 623526"}\n\n📞 *Phone:*\n${process.env.RESTAURANT_PHONE || "+91-9585960612"}\n\n🗺️ *Google Maps:*\n${process.env.RESTAURANT_MAPS_LINK || "https://maps.google.com"}\n\n⏰ *Hours:* Open daily`;

// ─────────────────────────────────────────────────────────────
// Normalise delivery keys (text-based fallback)
// ─────────────────────────────────────────────────────────────
const normalizeKey = (key) => {
  key = key.toLowerCase().trim().replace(/\r/g, "");
  if (/^(name|your name|full name|customer name)$/.test(key))                                      return "name";
  if (/^(phone|mobile|mob|phone no|phone number|mobile number|contact|number|ph|cell)$/.test(key)) return "phone";
  if (/^(address|addr|delivery address|location|house|flat|area|street)$/.test(key))               return "address";
  if (/^(pincode|pin|pin code|zip|postal|postal code)$/.test(key))                                 return "pincode";
  return key;
};

// ─────────────────────────────────────────────────────────────
// Category Menu (list)
// ─────────────────────────────────────────────────────────────
const buildCategoryMenu = async (to) => {
  const categoryRows = Object.entries(MENU).slice(0, 10).map(([key, val]) => ({
    id:          `CAT_${key.toUpperCase()}`,
    title:       val.label,
    description: `${val.items.length} items available`,
  }));

  await sendList(
    to,
    "🗂️ *Menu Categories*",
    "Choose a category to explore our Chettinadu menu:",
    "Browse Categories",
    [{ title: "Food Categories", rows: categoryRows }]
  );
};

// ─────────────────────────────────────────────────────────────
// Item Menu (list + pagination)
// ─────────────────────────────────────────────────────────────
const buildItemMenu = async (to, category, page = 0) => {
  const cat = MENU[category];
  if (!cat) { await sendText(to, "❌ Invalid category. Please try again."); return; }

  const PAGE_SIZE = 9;
  const start     = page * PAGE_SIZE;
  const end       = start + PAGE_SIZE;
  const items     = cat.items.slice(start, end);
  const hasMore   = cat.items.length > end;
  const hasPrev   = page > 0;

  const rows = items.map((item) => ({
    id:          `ITEM_${item.id}`,
    title:       item.name,
    description: `₹${item.price} — ${item.description}`,
  }));

  if (hasMore) rows.push({ id: `MORE_${category.toUpperCase()}_${page + 1}`, title: "➡️ More Items", description: `See items ${end + 1}–${Math.min(end + PAGE_SIZE, cat.items.length)}` });
  if (hasPrev) rows.push({ id: `MORE_${category.toUpperCase()}_${page - 1}`, title: "⬅️ Previous Items", description: "Go back to previous page" });

  const pageLabel = hasMore || hasPrev ? ` (Page ${page + 1})` : "";
  if (cat.image) await sendImage(to, cat.image, `${cat.emoji} *${cat.label}*${pageLabel}`);

  await sendList(
    to,
    `${cat.emoji} *${cat.label}*${pageLabel}`,
    "Select an item to add to your cart:",
    "Choose Item",
    [{ title: cat.label, rows }]
  );
};

// ─────────────────────────────────────────────────────────────
// Ask Payment Method
// ─────────────────────────────────────────────────────────────
const askPaymentMethod = async (from, session) => {
  const total = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  session.state = "SELECT_PAYMENT";
  await session.save();

  await sendButtons(
    from,
    `💰 *Total Amount: ₹${total}*\n\n─────────────────\nChoose your payment method:`,
    [
      { id: "PAY_UPI", title: "📲 UPI / QR Code" },
      { id: "PAY_COD", title: "💵 Cash on Delivery" },
    ]
  );
};

// ─────────────────────────────────────────────────────────────
// Send UPI QR
// ─────────────────────────────────────────────────────────────
const sendUpiDetails = async (from, session) => {
  const total  = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const upiId  = process.env.RESTAURANT_UPI_ID || "restaurant@upi";
  const qrUrl  = process.env.RESTAURANT_UPI_QR || "";
  const name   = process.env.RESTAURANT_NAME   || "Kavi Chettinadu";

  session.state = "CONFIRM_UPI";
  await session.save();

  if (qrUrl) await sendImage(from, qrUrl, `📲 Scan & Pay ₹${total} — ${name}`);

  await sendButtons(
    from,
    `📲 *UPI Payment Details*\n─────────────────\n🏪 *Pay to:* ${name}\n💳 *UPI ID:* ${upiId}\n💰 *Amount: ₹${total}*\n─────────────────\n\n1️⃣ Open GPay / PhonePe / Paytm\n2️⃣ Scan QR *or* pay to UPI ID above\n3️⃣ Enter amount ₹${total}\n4️⃣ Tap ✅ *Payment Done* below`,
    [
      { id: "UPI_DONE", title: "✅ Payment Done" },
      { id: "PAY_COD",  title: "💵 Pay COD instead" },
    ]
  );
};

// ─────────────────────────────────────────────────────────────
// Confirm & Place Order (text-bot flow)
// ─────────────────────────────────────────────────────────────
const confirmAndPlaceOrder = async (from, session, paymentMethod = "COD") => {
  const { name, phone, address, pincode } = session.deliveryData;
  const total = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const order = new Order({
    orderId:     "KAV" + Date.now(),
    phone:       from,
    name,
    address:     `${address}, ${pincode}`,
    items:       session.cart,
    totalAmount: total,
    paymentMethod: paymentMethod === "UPI" ? "UPI" : "Cash on Delivery",
    status: "confirmed",
  });
  await order.save();

  session.cart          = [];
  session.state         = "ORDER_PLACED";
  session.deliveryData  = {};
  session.deliveryStep  = null;
  session.markModified("cart");
  session.markModified("deliveryData");
  await session.save();

  const itemLines = order.items
    .map((i) => `• ${i.name} x${i.quantity} — ₹${i.price * i.quantity}`)
    .join("\n");
  const paymentLabel = paymentMethod === "UPI" ? "📲 UPI / QR Code (Paid)" : "💵 Cash on Delivery";

  await sendButtons(
    from,
    `🎉 *Order Placed Successfully!*\n\n─────────────────\n📦 *Order ID:* ${order.orderId}\n─────────────────\n\n${itemLines}\n\n─────────────────\n💰 *Total: ₹${total}*\n💳 *Payment: ${paymentLabel}*\n─────────────────\n\n👤 *Name:* ${name}\n📞 *Phone:* +91 ${phone}\n🏠 *Address:* ${address}\n📮 *Pincode:* ${pincode}\n\n⏱️ Est. Delivery: 30-45 mins\nThank you for ordering with us! 🙏`,
    [
      { id: "PLACE_ORDER_FLOW", title: "🍴 Order Again" },
      { id: "EXIT",             title: "❌ Exit" },
    ]
  );
};

// ─────────────────────────────────────────────────────────────
// Handle Catalogue Order (WhatsApp Catalogue cart)
// ─────────────────────────────────────────────────────────────
const handleCatalogueOrder = async (from, session, catalogueOrder) => {
  const items = catalogueOrder.product_items || [];

  for (const item of items) {
    const productInfo = CATALOGUE_MAP[item.product_retailer_id];
    if (!productInfo) { console.warn("⚠️ Unknown catalogue product:", item.product_retailer_id); continue; }

    const existingIndex = session.cart.findIndex((c) => c.itemId === productInfo.id);
    if (existingIndex >= 0) {
      session.cart[existingIndex].quantity += item.quantity;
    } else {
      session.cart.push({ itemId: productInfo.id, name: productInfo.name, price: productInfo.price, quantity: item.quantity, category: productInfo.category });
    }
  }

  session.markModified("cart");
  await session.save();

  const total     = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemLines = session.cart.map((i) => `• ${i.name} × ${i.quantity} = ₹${i.price * i.quantity}`).join("\n");

  await sendButtons(
    from,
    `🛒 *Your Cart*\n─────────────────\n${itemLines}\n─────────────────\n💰 *Total: ₹${total}*\n\nReady to place your order?`,
    [
      { id: "PLACE_ORDER_FLOW", title: "✅ Place Order" },
      { id: "VIEW_MENU",        title: "➕ Add More"   },
      { id: "EXIT",             title: "❌ Exit"        },
    ]
  );
};

// ─────────────────────────────────────────────────────────────
// Main Bot Handler
// ─────────────────────────────────────────────────────────────
const handleMessage = async (from, messageBody, interactiveReply, locationData = null, catalogueOrder = null) => {
  try {
    console.log("🔥 handleMessage started");

    let session = await Session.findOne({ phoneNumber: from });
    if (!session) {
      session = new Session({ phoneNumber: from, state: "WELCOME", cart: [] });
      await session.save();
    }

    if (!session.cart) session.cart = [];
    session.lastActivity = new Date();

    const rawInput = messageBody?.trim();
    const input    = interactiveReply?.id || rawInput?.toLowerCase();

    console.log("📥 Input:", input, "| State:", session.state, "| Step:", session.deliveryStep);

    // ── CATALOGUE ORDER ────────────────────────────────────
    if (catalogueOrder) {
      await handleCatalogueOrder(from, session, catalogueOrder);
      return;
    }

    // ── EXIT ──────────────────────────────────────────────
    if (["EXIT", "exit", "bye", "quit"].includes(input)) {
      session.state        = "WELCOME";
      session.cart         = [];
      session.deliveryStep = null;
      session.deliveryData = {};
      session.markModified("cart");
      session.markModified("deliveryData");
      await session.save();
      await sendText(from, `👋 *Thank you for visiting ${process.env.RESTAURANT_NAME || "Kavi Chettinadu Restaurant"}!*\n\nSend *hi* anytime to place a new order. 🍽️`);
      return;
    }

    // ── GREETING → WhatsApp Flow அனுப்பு ─────────────────
    // "hi", "hello" etc. வரும்போது Flow button அனுப்பு
    if (["hi", "hello", "hey", "start", "menu", "MAIN_MENU"].includes(input)) {
      session.state        = "MAIN_MENU";
      session.deliveryStep = null;
      session.deliveryData = {};
      session.markModified("deliveryData");
      await session.save();

      // WhatsApp Flow button அனுப்பு
      await sendOrderFlow(from);
      return;
    }

    // ── PLACE_ORDER_FLOW → Flow button மீண்டும் அனுப்பு ──
    if (input === "PLACE_ORDER_FLOW") {
      session.cart         = [];
      session.deliveryStep = null;
      session.deliveryData = {};
      session.markModified("cart");
      session.markModified("deliveryData");
      await session.save();
      await sendOrderFlow(from);
      return;
    }

    // ── UPI CONFIRMED ─────────────────────────────────────
    if (input === "UPI_DONE") {
      await confirmAndPlaceOrder(from, session, "UPI");
      return;
    }

    // ── PAY COD ───────────────────────────────────────────
    if (input === "PAY_COD") {
      await confirmAndPlaceOrder(from, session, "COD");
      return;
    }

    // ── PAY UPI ───────────────────────────────────────────
    if (input === "PAY_UPI") {
      await sendUpiDetails(from, session);
      return;
    }

    // ── ADD ONE MORE ──────────────────────────────────────
    if (input === "ADD_MORE_QTY") {
      const lastItem = session.cart[session.cart.length - 1];
      if (lastItem) {
        lastItem.quantity += 1;
        session.markModified("cart");
        await session.save();
        const total = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        await sendButtons(from, `✅ *${lastItem.name}*\n\nQty: ${lastItem.quantity} × ₹${lastItem.price} = ₹${lastItem.price * lastItem.quantity}\n\n🛒 *Cart Total: ₹${total}*`, [
          { id: "ADD_MORE_QTY",    title: "➕ Add One More" },
          { id: "VIEW_CART",       title: "🛒 View Cart"    },
          { id: "PLACE_ORDER_FLOW",title: "✅ Place Order"  },
        ]);
      }
      return;
    }

    // ── REMOVE ONE ────────────────────────────────────────
    if (input === "REMOVE_ONE_QTY") {
      const lastItem = session.cart[session.cart.length - 1];
      if (lastItem) {
        if (lastItem.quantity > 1) { lastItem.quantity -= 1; } else { session.cart.pop(); }
        session.markModified("cart");
        await session.save();
        const total = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        if (session.cart.length === 0) {
          await sendButtons(from, `🗑️ *${lastItem.name}* removed.\n\n🛒 Cart is empty.`, [{ id: "PLACE_ORDER_FLOW", title: "🍴 Browse Menu" }, { id: "EXIT", title: "❌ Exit" }]);
        } else {
          await sendButtons(from, `✅ *${lastItem.name}*\n\nQty: ${lastItem.quantity} × ₹${lastItem.price} = ₹${lastItem.price * lastItem.quantity}\n\n🛒 *Cart Total: ₹${total}*`, [
            { id: "ADD_MORE_QTY",    title: "➕ Add One More"  },
            { id: "REMOVE_ONE_QTY", title: "➖ Remove One"    },
            { id: "PLACE_ORDER_FLOW",title: "✅ Place Order"  },
          ]);
        }
      }
      return;
    }

    // ── LOCATION FLOW ─────────────────────────────────────
    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === null && locationData) {
      const address = locationData.address || `https://maps.google.com/?q=${locationData.lat},${locationData.lng}`;
      session.deliveryData = { name: "", address, phone: "", pincode: "" };
      session.deliveryStep = "name";
      session.markModified("deliveryData");
      await session.save();
      await sendText(from, `📍 *Location received!*\n✅ Address saved.\n\n─────────────────\nPlease send your *full name:*`);
      return;
    }

    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === "name") {
      session.deliveryData.name = rawInput?.trim() || "Customer";
      session.deliveryStep      = "phone";
      session.markModified("deliveryData");
      await session.save();
      await sendText(from, `👤 *Name saved:* ${session.deliveryData.name}\n\n─────────────────\nNow please send your *10-digit mobile number:*`);
      return;
    }

    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === "phone") {
      let phone = rawInput?.replace(/\D/g, "") || "";
      if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
      if (phone.length === 11 && phone.startsWith("0"))  phone = phone.slice(1);
      if (!/^\d{10}$/.test(phone)) { await sendText(from, "❌ *Invalid phone number.*\n\nPlease send a valid *10-digit mobile number:*"); return; }
      session.deliveryData.phone = phone;
      session.deliveryStep       = "pincode";
      session.markModified("deliveryData");
      await session.save();
      await sendText(from, `📞 *Phone saved:* +91 ${phone}\n\n─────────────────\nNow please send your *6-digit pincode:*`);
      return;
    }

    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === "pincode") {
      const pincode = rawInput?.replace(/\D/g, "") || "";
      if (!/^\d{6}$/.test(pincode)) { await sendText(from, "❌ *Invalid pincode.*\n\nPlease send a valid *6-digit pincode:*"); return; }
      session.deliveryData.pincode = pincode;
      session.deliveryStep         = null;
      session.markModified("deliveryData");
      await session.save();
      await askPaymentMethod(from, session);
      return;
    }

    // ── TEXT-BASED DELIVERY (one message) ─────────────────
    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === null && !interactiveReply && !locationData) {
      const data  = {};
      const lines = rawInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      lines.forEach((line) => {
        const match = line.match(/^([^:\-=]+)[\s:\-=]+(.+)$/);
        if (match) { data[normalizeKey(match[1])] = match[2].trim().replace(/\r/g, ""); }
      });
      if (!data["phone"]) { const m = rawInput.match(/(?:\+91|91|0)?([6-9]\d{9})/); if (m) data["phone"] = m[1]; }
      if (!data["pincode"]) { const m = rawInput.match(/\b(\d{6})\b/); if (m) data["pincode"] = m[1]; }
      if (!data["name"] || !data["address"]) {
        const addrLines = [];
        lines.forEach((line) => {
          const digits = line.replace(/\D/g, "");
          if (digits === data["phone"] || digits === data["pincode"] || /^\+?[\d\s\-]{6,}$/.test(line)) return;
          if (!data["name"]) { data["name"] = line; return; }
          addrLines.push(line);
        });
        if (!data["address"] && addrLines.length > 0) data["address"] = addrLines.join(", ");
      }

      let phone = (data["phone"] || "").trim().replace(/\D/g, "");
      if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
      if (phone.length === 11 && phone.startsWith("0"))  phone = phone.slice(1);

      const name    = (data["name"]    || "Customer").trim();
      const address = (data["address"] || "").trim();
      const pincode = (data["pincode"] || "").trim().replace(/\D/g, "");

      const errors = [];
      if (!address)                 errors.push("❌ *Address* is required");
      if (!/^\d{10}$/.test(phone))  errors.push("❌ *Phone* must be a valid 10-digit mobile number");
      if (!/^\d{6}$/.test(pincode)) errors.push("❌ *Pincode* must be exactly 6 digits");

      if (errors.length > 0) {
        await sendText(from, `${errors.join("\n")}\n\n─────────────────\nPlease send your details like this:\n\nName: Raj Kumar\nPhone: 9876543210\nAddress: 12, Main Street, Rameswaram\nPincode: 623526\n\n📍 Or share your *current location* using WhatsApp's 📎 attachment → Location`);
        return;
      }

      session.deliveryData = { name, phone, address, pincode };
      session.deliveryStep = null;
      session.markModified("deliveryData");
      await session.save();
      await askPaymentMethod(from, session);
      return;
    }

    // ── VIEW MENU (list-based fallback) ───────────────────
    if (input === "VIEW_MENU") {
      session.state = "CATEGORY_MENU";
      await session.save();
      await buildCategoryMenu(from);
      return;
    }

    // ── CONTACT ───────────────────────────────────────────
    if (input === "CONTACT") {
      await sendButtons(from, buildContactMessage(), [
        { id: "PLACE_ORDER_FLOW", title: "🍴 View Menu" },
        { id: "EXIT",             title: "❌ Exit" },
      ]);
      return;
    }

    // ── PAGINATION ────────────────────────────────────────
    if (input?.startsWith("MORE_")) {
      const parts       = input.split("_");
      const page        = parseInt(parts[parts.length - 1]);
      const categoryKey = parts.slice(1, parts.length - 1).join("_").toLowerCase();
      session.currentCategory = categoryKey;
      await session.save();
      await buildItemMenu(from, categoryKey, page);
      return;
    }

    // ── CATEGORY SELECT ───────────────────────────────────
    if (input?.startsWith("CAT_")) {
      const categoryKey       = input.replace("CAT_", "").toLowerCase();
      session.currentCategory = categoryKey;
      session.state           = "ITEM_MENU";
      await session.save();
      await buildItemMenu(from, categoryKey, 0);
      return;
    }

    // ── ITEM SELECT → Add to Cart ─────────────────────────
    if (input?.startsWith("ITEM_")) {
      const itemId = input.replace("ITEM_", "");
      let foundItem = null, foundCategory = null;

      for (const [catKey, catData] of Object.entries(MENU)) {
        const item = catData.items.find((i) => i.id === itemId);
        if (item) { foundItem = item; foundCategory = catKey; break; }
      }

      if (!foundItem) { await sendText(from, "❌ Item not found. Please try again."); return; }

      const existingIndex = session.cart.findIndex((c) => c.itemId === itemId);
      if (existingIndex >= 0) { session.cart[existingIndex].quantity += 1; }
      else { session.cart.push({ itemId: foundItem.id, name: foundItem.name, price: foundItem.price, quantity: 1, category: foundCategory }); }
      session.markModified("cart");
      await session.save();

      const currentQty = existingIndex >= 0 ? session.cart[existingIndex].quantity : 1;
      const total = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);

      if (foundItem.image) await sendImage(from, foundItem.image, `${foundItem.name} — ₹${foundItem.price}`);

      await sendButtons(from, `✅ *${foundItem.name}* added to cart!\n\nQty: ${currentQty} × ₹${foundItem.price} = ₹${foundItem.price * currentQty}\n\n🛒 *Cart Total: ₹${total}*`, [
        { id: "ADD_MORE_QTY",    title: "➕ Add One More"  },
        { id: "REMOVE_ONE_QTY", title: "➖ Remove One"    },
        { id: "PLACE_ORDER_FLOW",title: "✅ Place Order"  },
      ]);
      return;
    }

    // ── VIEW CART ─────────────────────────────────────────
    if (input === "VIEW_CART" || input === "cart") {
      const cartMsg = buildCartMessage(session.cart);
      if (!session.cart || session.cart.length === 0) {
        await sendButtons(from, cartMsg, [{ id: "PLACE_ORDER_FLOW", title: "🍴 Browse Menu" }, { id: "EXIT", title: "❌ Exit" }]);
      } else {
        await sendButtons(from, cartMsg, [{ id: "PLACE_ORDER_FLOW", title: "✅ Place Order" }, { id: "VIEW_MENU", title: "➕ Add More" }, { id: "EXIT", title: "❌ Exit" }]);
      }
      return;
    }

    // ── FALLBACK ──────────────────────────────────────────
    await sendButtons(
      from,
      `🤔 I didn't understand that.\n\nSend *hi* to start ordering!`,
      [
        { id: "PLACE_ORDER_FLOW", title: "🍴 Order Now"   },
        { id: "CONTACT",          title: "📍 Contact Us"  },
        { id: "EXIT",             title: "❌ Exit"         },
      ]
    );

  } catch (err) {
    console.error("❌ handleMessage Error:", err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  }
};

module.exports = { handleMessage };