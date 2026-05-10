const Session  = require("../models/Session");
const Order    = require("../models/Order");
const MENU     = require("../config/menu");
const axios    = require("axios");
const { sendText, sendButtons, sendList } = require("../config/whatsapp");

// ─────────────────────────────────────────────────────────────
// Send Image
// ─────────────────────────────────────────────────────────────

const sendImage = async (to, imageUrl, caption = "") => {
  try {
    const API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
    const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "image",
        image: { link: imageUrl, caption },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("❌ sendImage error:", err.response?.data || err.message);
  }
};

// ─────────────────────────────────────────────────────────────
// Normalize delivery field keys
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
// Welcome Message
// ─────────────────────────────────────────────────────────────

const buildWelcomeMessage = () =>
  `🍽️ *Welcome to ${process.env.RESTAURANT_NAME || "Kavi Chettinadu Restaurant"}!* 🍽️

_Taste The Tradition_ ✨

Authentic Chettinadu flavours from the heart of Rameswaram!

How can we help you today?`;

// ─────────────────────────────────────────────────────────────
// Main Menu
// ─────────────────────────────────────────────────────────────

const buildMainMenu = async (to) => {
  await sendButtons(to, buildWelcomeMessage(), [
    { id: "VIEW_MENU", title: "🍴 View Menu" },
    { id: "CONTACT",   title: "📍 Contact Us" },
    { id: "EXIT",      title: "❌ Exit" },
  ]);
};

// ─────────────────────────────────────────────────────────────
// Category Menu
// ─────────────────────────────────────────────────────────────

const buildCategoryMenu = async (to) => {
  const categoryRows = Object.entries(MENU).slice(0, 10).map(([key, val]) => ({
    id:          `CAT_${key.toUpperCase()}`,
    title:       val.label,
    description: `${val.items.length} items available`,
  }));
  await sendList(
    to,
    "🗂️ *Menu Categories*\n\nChoose a category to explore:",
    "Browse Categories",
    [{ title: "Food Categories", rows: categoryRows }]
  );
};

// ─────────────────────────────────────────────────────────────
// Items Menu
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

  if (hasMore) rows.push({
    id:          `MORE_${category.toUpperCase()}_${page + 1}`,
    title:       "➡️ More Items",
    description: `See items ${end + 1}–${Math.min(end + PAGE_SIZE, cat.items.length)}`,
  });
  if (hasPrev) rows.push({
    id:          `MORE_${category.toUpperCase()}_${page - 1}`,
    title:       "⬅️ Previous Items",
    description: "Go back to previous page",
  });

  const pageLabel = hasMore || hasPrev ? ` (Page ${page + 1})` : "";
  await sendImage(to, cat.image, `${cat.emoji} *${cat.label}*${pageLabel}`);
  await sendList(
    to,
    `${cat.emoji} *${cat.label}*${pageLabel}\n\nSelect an item to add to your cart:`,
    "Choose Item",
    [{ title: cat.label, rows }]
  );
};

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
  `📍 *Contact & Location*

🏠 *Address:*
${process.env.RESTAURANT_ADDRESS || "14/12A1, Rameswaram - 623526"}

📞 *Phone:*
${process.env.RESTAURANT_PHONE || "+91-9585960612"}

🗺️ *Google Maps:*
${process.env.RESTAURANT_MAPS_LINK || "https://maps.google.com"}

⏰ *Hours:* Open daily`;

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
// Send UPI QR & Details
// ─────────────────────────────────────────────────────────────

const sendUpiDetails = async (from, session) => {
  const total = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const upiId = process.env.RESTAURANT_UPI_ID || "restaurant@upi";
  const qrUrl = process.env.RESTAURANT_UPI_QR || "";
  const name  = process.env.RESTAURANT_NAME   || "Kavi Chettinadu";

  session.state = "CONFIRM_UPI";
  await session.save();

  if (qrUrl) {
    await sendImage(from, qrUrl, `📲 Scan & Pay ₹${total} — ${name}`);
  }

  await sendButtons(
    from,
    `📲 *UPI Payment Details*
─────────────────
🏪 *Pay to:* ${name}
💳 *UPI ID:* ${upiId}
💰 *Amount: ₹${total}*
─────────────────

1️⃣ Open GPay / PhonePe / Paytm
2️⃣ Scan QR *or* pay to UPI ID above
3️⃣ Enter amount ₹${total}
4️⃣ Tap ✅ *Payment Done* below`,
    [
      { id: "UPI_DONE", title: "✅ Payment Done" },
      { id: "PAY_COD",  title: "💵 Pay COD instead" },
    ]
  );
};

// ─────────────────────────────────────────────────────────────
// Confirm & Place Order
// ─────────────────────────────────────────────────────────────

const confirmAndPlaceOrder = async (from, session, paymentMethod = "COD") => {
  const { name, phone, address, pincode } = session.deliveryData;
  const total = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const order = new Order({
    phoneNumber:     from,
    items:           session.cart,
    totalAmount:     total,
    deliveryDetails: { name, phone, address, pincode },
    paymentMethod,
  });
  await order.save();

  session.cart          = [];
  session.state         = "ORDER_PLACED";
  session.deliveryData  = {};
  session.deliveryStep  = null;
  session.paymentMethod = null;
  session.markModified("cart");
  session.markModified("deliveryData");
  await session.save();

  const itemLines = order.items
    .map((i) => `• ${i.name} x${i.quantity} — ₹${i.price * i.quantity}`)
    .join("\n");

  const paymentLabel =
    paymentMethod === "UPI" ? "📲 UPI / QR Code (Paid)" : "💵 Cash on Delivery";

  await sendButtons(
    from,
    `🎉 *Order Placed Successfully!*

─────────────────
📦 *Order ID:* ${order.orderId}
─────────────────

${itemLines}

─────────────────
💰 *Total: ₹${total}*
💳 *Payment: ${paymentLabel}*
─────────────────

👤 *Name:* ${name}
📞 *Phone:* +91 ${phone}
🏠 *Address:* ${address}
📮 *Pincode:* ${pincode}

⏱️ Est. Delivery: ${order.estimatedDelivery} mins
Thank you for ordering with us! 🙏`,
    [
      { id: "VIEW_MENU", title: "🍴 Order Again" },
      { id: "EXIT",      title: "❌ Exit" },
    ]
  );
};

// ─────────────────────────────────────────────────────────────
// Handle Message (Main Bot Logic)
// ─────────────────────────────────────────────────────────────

const handleMessage = async (from, messageBody, interactiveReply, locationData = null) => {
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

    // ── EXIT ──────────────────────────────────────────────────
    if (["EXIT", "exit", "bye", "quit"].includes(input)) {
      session.state         = "WELCOME";
      session.cart          = [];
      session.deliveryStep  = null;
      session.deliveryData  = {};
      session.paymentMethod = null;
      session.markModified("cart");
      session.markModified("deliveryData");
      await session.save();
      await sendText(
        from,
        `👋 *Thank you for visiting ${process.env.RESTAURANT_NAME || "Kavi Chettinadu Restaurant"}!*\n\nSend *hi* anytime to place a new order. 🍽️`
      );
      return;
    }

    // ── UPI CONFIRMED ─────────────────────────────────────────
    if (input === "UPI_DONE") {
      await confirmAndPlaceOrder(from, session, "UPI");
      return;
    }

    // ── PAY COD ───────────────────────────────────────────────
    if (input === "PAY_COD") {
      await confirmAndPlaceOrder(from, session, "COD");
      return;
    }

    // ── PAY UPI → Show QR ─────────────────────────────────────
    if (input === "PAY_UPI") {
      await sendUpiDetails(from, session);
      return;
    }

    // ── LOCATION FLOW — Step 1: Location received → ask name ──
    if (
      session.state === "COLLECT_DETAILS" &&
      session.deliveryStep === null &&
      locationData
    ) {
      const address = locationData.address ||
        `https://maps.google.com/?q=${locationData.lat},${locationData.lng}`;

      session.deliveryData = { name: "", address, phone: "", pincode: "" };
      session.deliveryStep = "phone";  // reusing "phone" step to collect name first
      session.markModified("deliveryData");
      await session.save();

      await sendText(
        from,
        `📍 *Location received!*\n✅ Address saved.\n\n─────────────────\nPlease send your *full name:*`
      );
      return;
    }

    // ── LOCATION FLOW — Step 2: Name received → ask phone ─────
    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === "phone") {
      const name = rawInput?.trim() || "Customer";
      session.deliveryData.name = name;
      session.deliveryStep      = "pincode";
      session.markModified("deliveryData");
      await session.save();

      await sendText(
        from,
        `👤 *Name saved:* ${name}\n\n─────────────────\nNow please send your *10-digit mobile number:*`
      );
      return;
    }

    // ── LOCATION FLOW — Step 3: Phone received → ask pincode ──
    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === "pincode") {
      let phone = rawInput?.replace(/\D/g, "") || "";
      if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
      if (phone.length === 11 && phone.startsWith("0"))  phone = phone.slice(1);

      if (!/^\d{10}$/.test(phone)) {
        await sendText(from, "❌ *Invalid phone number.*\n\nPlease send a valid *10-digit mobile number:*");
        return;
      }

      session.deliveryData.phone = phone;
      session.deliveryStep       = "confirm";
      session.markModified("deliveryData");
      await session.save();

      await sendText(
        from,
        `📞 *Phone saved:* +91 ${phone}\n\n─────────────────\nNow please send your *6-digit pincode:*`
      );
      return;
    }

    // ── LOCATION FLOW — Step 4: Pincode received → payment ────
    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === "confirm") {
      const pincode = rawInput?.replace(/\D/g, "") || "";

      if (!/^\d{6}$/.test(pincode)) {
        await sendText(from, "❌ *Invalid pincode.*\n\nPlease send a valid *6-digit pincode:*");
        return;
      }

      session.deliveryData.pincode = pincode;
      session.deliveryStep         = null;
      session.markModified("deliveryData");
      await session.save();

      await askPaymentMethod(from, session);
      return;
    }

    // ── TEXT FLOW — All details in one message ─────────────────
    if (
      session.state === "COLLECT_DETAILS" &&
      session.deliveryStep === null &&
      !interactiveReply &&
      !locationData
    ) {
      const data  = {};
      const lines = rawInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      // Label-based parsing
      lines.forEach((line) => {
        const match = line.match(/^([^:\-=]+)[\s:\-=]+(.+)$/);
        if (match) {
          const key   = normalizeKey(match[1]);
          const value = match[2].trim().replace(/\r/g, "");
          data[key]   = value;
        }
      });

      // Auto-detect phone
      if (!data["phone"]) {
        const m = rawInput.match(/(?:\+91|91|0)?([6-9]\d{9})/);
        if (m) data["phone"] = m[1];
      }

      // Auto-detect pincode
      if (!data["pincode"]) {
        const m = rawInput.match(/\b(\d{6})\b/);
        if (m) data["pincode"] = m[1];
      }

      // Label-free fallback
      if (!data["name"] || !data["address"]) {
        const addrLines = [];
        lines.forEach((line) => {
          const digits = line.replace(/\D/g, "");
          if (digits === data["phone"])        return;
          if (digits === data["pincode"])      return;
          if (/^\+?[\d\s\-]{6,}$/.test(line)) return;
          if (!data["name"]) { data["name"] = line; return; }
          addrLines.push(line);
        });
        if (!data["address"] && addrLines.length > 0)
          data["address"] = addrLines.join(", ");
      }

      // Clean fields
      const name    = (data["name"]    || "Customer").trim();
      const address = (data["address"] || "").trim();

      let phone = (data["phone"] || "").trim().replace(/\D/g, "");
      if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
      if (phone.length === 11 && phone.startsWith("0"))  phone = phone.slice(1);

      const pincode = (data["pincode"] || "").trim().replace(/\D/g, "");

      console.log("📋 Parsed delivery data:", { name, phone, address, pincode });

      const errors = [];
      if (!/^\d{10}$/.test(phone))  errors.push("❌ *Phone* must be a valid 10-digit mobile number");
      if (!/^\d{6}$/.test(pincode)) errors.push("❌ *Pincode* must be exactly 6 digits");

      if (errors.length > 0) {
        await sendText(
          from,
          `${errors.join("\n")}\n\n─────────────────\nPlease send your details like this:\n\nName: Raj Kumar\nPhone: 9876543210\nAddress: 12, Main Street, Rameswaram\nPincode: 623526\n\n📍 Or share your *current location* using WhatsApp's 📎 attachment → Location`
        );
        return;
      }

      session.deliveryData = { name, phone, address, pincode };
      session.deliveryStep = null;
      session.markModified("deliveryData");
      await session.save();

      await askPaymentMethod(from, session);
      return;
    }

    // ── GREETING ──────────────────────────────────────────────
    if (["hi", "hello", "hey", "start", "menu", "MAIN_MENU"].includes(input)) {
      session.state = "MAIN_MENU";
      await session.save();
      await buildMainMenu(from);
      return;
    }

    // ── VIEW MENU ─────────────────────────────────────────────
    if (input === "VIEW_MENU") {
      session.state = "CATEGORY_MENU";
      await session.save();
      await buildCategoryMenu(from);
      return;
    }

    // ── CONTACT ───────────────────────────────────────────────
    if (input === "CONTACT") {
      await sendButtons(from, buildContactMessage(), [
        { id: "VIEW_MENU", title: "🍴 View Menu" },
        { id: "EXIT",      title: "❌ Exit" },
      ]);
      return;
    }

    // ── PAGINATION ────────────────────────────────────────────
    if (input?.startsWith("MORE_")) {
      const parts       = input.split("_");
      const page        = parseInt(parts[parts.length - 1]);
      const categoryKey = parts.slice(1, parts.length - 1).join("_").toLowerCase();
      session.currentCategory = categoryKey;
      await session.save();
      await buildItemMenu(from, categoryKey, page);
      return;
    }

    // ── CATEGORY SELECT ───────────────────────────────────────
    if (input?.startsWith("CAT_")) {
      const categoryKey       = input.replace("CAT_", "").toLowerCase();
      session.currentCategory = categoryKey;
      session.state           = "ITEM_MENU";
      await session.save();
      await buildItemMenu(from, categoryKey, 0);
      return;
    }

    // ── ITEM SELECT → Add to Cart ─────────────────────────────
    if (input?.startsWith("ITEM_")) {
      const itemId = input.replace("ITEM_", "");
      let foundItem = null, foundCategory = null;

      for (const [catKey, catData] of Object.entries(MENU)) {
        const item = catData.items.find((i) => i.id === itemId);
        if (item) { foundItem = item; foundCategory = catKey; break; }
      }

      if (!foundItem) {
        await sendText(from, "❌ Item not found. Please try again.");
        return;
      }

      const existingIndex = session.cart.findIndex((c) => c.itemId === itemId);
      if (existingIndex >= 0) {
        session.cart[existingIndex].quantity += 1;
      } else {
        session.cart.push({
          itemId:   foundItem.id,
          name:     foundItem.name,
          price:    foundItem.price,
          quantity: 1,
          category: foundCategory,
        });
      }
      session.markModified("cart");
      await session.save();

      const total = session.cart.reduce((s, i) => s + i.price * i.quantity, 0);

      if (foundItem.image) {
        await sendImage(from, foundItem.image, `${foundItem.name} — ₹${foundItem.price}`);
      }

      await sendButtons(
        from,
        `✅ *${foundItem.name}* added to cart!\n\n🛒 Cart Total: ₹${total}`,
        [
          { id: "VIEW_MENU",   title: "➕ Add More" },
          { id: "VIEW_CART",   title: "🛒 View Cart" },
          { id: "PLACE_ORDER", title: "✅ Place Order" },
        ]
      );
      return;
    }

    // ── VIEW CART ─────────────────────────────────────────────
    if (input === "VIEW_CART" || input === "cart") {
      const cartMsg = buildCartMessage(session.cart);
      if (!session.cart || session.cart.length === 0) {
        await sendButtons(from, cartMsg, [
          { id: "VIEW_MENU", title: "🍴 Browse Menu" },
          { id: "EXIT",      title: "❌ Exit" },
        ]);
      } else {
        await sendButtons(from, cartMsg, [
          { id: "PLACE_ORDER", title: "✅ Place Order" },
          { id: "VIEW_MENU",   title: "➕ Add More" },
          { id: "EXIT",        title: "❌ Exit" },
        ]);
      }
      return;
    }

    // ── PLACE ORDER ───────────────────────────────────────────
    if (input === "PLACE_ORDER") {
      if (!session.cart || session.cart.length === 0) {
        await sendButtons(from, "🛒 Your cart is empty! Add items first.", [
          { id: "VIEW_MENU", title: "🍴 Browse Menu" },
          { id: "EXIT",      title: "❌ Exit" },
        ]);
        return;
      }

      session.state        = "COLLECT_DETAILS";
      session.deliveryStep = null;
      session.deliveryData = {};
      session.markModified("deliveryData");
      await session.save();

      await sendText(
        from,
        `${buildCartMessage(session.cart)}

─────────────────
📦 *Enter Delivery Details:*

Please reply in *one message* 👇

Name: Your full name
Phone: 10-digit mobile number
Address: Your delivery address
Pincode: 6-digit pincode

📍 *Or share your current location!*
Tap 📎 attachment → Location → Send Current Location`
      );
      return;
    }

    // ── FALLBACK ──────────────────────────────────────────────
    await sendButtons(
      from,
      `🤔 I didn't understand that.\n\nSend *hi* to start, or choose an option:`,
      [
        { id: "VIEW_MENU", title: "🍴 View Menu" },
        { id: "CONTACT",   title: "📍 Contact Us" },
        { id: "EXIT",      title: "❌ Exit" },
      ]
    );

  } catch (err) {
    console.error("❌ handleMessage Error:", err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  }
};

// ─────────────────────────────────────────────────────────────
// GET — Webhook Verification
// ─────────────────────────────────────────────────────────────

const verifyWebhook = (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔐 Webhook verification attempt");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  console.error("❌ Webhook verification failed");
  return res.sendStatus(403);
};

// ─────────────────────────────────────────────────────────────
// POST — Receive Incoming Messages
// ─────────────────────────────────────────────────────────────

const receiveMessage = async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;

    if (body?.object !== "whatsapp_business_account") return;

    const changes = body?.entry?.[0]?.changes?.[0]?.value;
    if (changes?.statuses) { console.log("📬 Status update — ignored"); return; }

    const message = changes?.messages?.[0];
    if (!message) return;

    const from = message.from;
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📨 From:", from, "| Type:", message.type);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let messageBody      = null;
    let interactiveReply = null;
    let locationData     = null;

    if (message.type === "text") {
      messageBody = message.text?.body || "";
    }
    else if (message.type === "interactive") {
      const ia = message.interactive;
      if (ia.type === "button_reply") {
        interactiveReply = { id: ia.button_reply.id, title: ia.button_reply.title };
      } else if (ia.type === "list_reply") {
        interactiveReply = { id: ia.list_reply.id, title: ia.list_reply.title };
      }
    }
    else if (message.type === "location") {
      const loc    = message.location;
      locationData = {
        lat:     loc.latitude,
        lng:     loc.longitude,
        address: loc.address || loc.name ||
          `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`,
      };
      messageBody = "__LOCATION__";
      console.log("📍 Location received:", locationData);
    }
    else {
      console.log("⚠️ Unsupported type:", message.type, "— ignored");
      return;
    }

    await handleMessage(from, messageBody, interactiveReply, locationData);

  } catch (err) {
    console.error("❌ receiveMessage Error:", err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  }
};

module.exports = { verifyWebhook, receiveMessage, handleMessage };