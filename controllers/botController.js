const Session = require("../models/Session");
const Order = require("../models/Order");
const {
  sendText,
  sendButtons,
  sendList,
  sendImage,
  sendOrderFlow,
  sendOrderConfirmation,
} = require("../config/whatsapp");

// ─────────────────────────────────────────────────────────
// MENU DATA
// ─────────────────────────────────────────────────────────
const MENU = {
  soups: {
    label: "🍲 Soups",
    subcategories: {
      veg_soups: {
        label: "🥦 Veg Soups",
        items: [
          { id: "hot_sour_veg", name: "Hot & Sour Veg Soup", price: 80 },
          { id: "sweet_corn_veg", name: "Sweet Corn Veg Soup", price: 80 },
          { id: "clear_soup", name: "Clear Soup", price: 80 },
        ],
      },
      nonveg_soups: {
        label: "🍗 Non-Veg Soups",
        items: [
          { id: "crab_soup", name: "Crab Soup", price: 120 },
          { id: "hs_chicken_soup", name: "Hot & Sour Chicken Soup", price: 100 },
          { id: "chicken_clear_soup", name: "Chicken Clear Soup", price: 100 },
        ],
      },
    },
  },
  starters: {
    label: "🍢 Starters",
    subcategories: {
      veg_starters: {
        label: "🥦 Veg Starters",
        items: [
          { id: "french_fries", name: "French Fries", price: 120 },
          { id: "gobi_65", name: "Gobi 65", price: 150 },
          { id: "mushroom_65", name: "Mushroom 65", price: 150 },
          { id: "paneer_tikka", name: "Paneer Tikka", price: 160 },
        ],
      },
      nonveg_starters: {
        label: "🍗 Non-Veg Starters",
        items: [
          { id: "chilly_chicken_bl", name: "Chilly Chicken BL", price: 200 },
          { id: "chicken_tikka", name: "Chicken Tikka", price: 180 },
          { id: "chicken_65_bl", name: "Chicken 65 BL", price: 200 },
          { id: "honey_chicken", name: "Honey Chicken", price: 220 },
          { id: "dragon_chicken", name: "Dragon Chicken", price: 200 },
          { id: "alfaham_chicken", name: "Alfaham Chicken", price: 200 },
        ],
      },
    },
  },
  bbq: {
    label: "🔥 BBQ / Grill / Tandoori",
    subcategories: {
      bbq_grill: {
        label: "🔥 BBQ / Grill",
        items: [
          { id: "grill_full", name: "Grill Chicken - Full", price: 460 },
          { id: "grill_half", name: "Grill Chicken - Half", price: 240 },
          { id: "bbq_full", name: "BBQ Chicken - Full", price: 480 },
          { id: "bbq_half", name: "BBQ Chicken - Half", price: 250 },
          { id: "bbq_wings", name: "BBQ Juicy Wings 5pcs", price: 200 },
        ],
      },
      tandoori: {
        label: "🍗 Tandoori",
        items: [
          { id: "tand_full", name: "Tandoori Chicken - Full", price: 480 },
          { id: "tand_half", name: "Tandoori Chicken - Half", price: 250 },
          { id: "tand_platter", name: "Tandoori Platter", price: 500 },
          { id: "fish_tikka", name: "Fish Tikka", price: 200 },
          { id: "prawns_tikka", name: "Prawns Tikka", price: 240 },
        ],
      },
      fried_chicken: {
        label: "🍗 Fried Chicken",
        items: [
          { id: "bucket_5pcs", name: "Bucket 5pcs", price: 450 },
          { id: "bucket_10pcs", name: "Bucket 10pcs", price: 880 },
          { id: "lolipop_5pcs", name: "Lolipop 5pcs", price: 250 },
          { id: "wings_5pcs", name: "Wings 5pcs", price: 230 },
          { id: "popcorn", name: "Popcorn", price: 160 },
        ],
      },
    },
  },
  biryani: {
    label: "🍛 Biryani",
    subcategories: {
      regular_biryani: {
        label: "Regular Biryani",
        items: [
          { id: "mutton_biryani", name: "Mutton Biriyani", price: 280 },
          { id: "chicken_biryani", name: "Chicken Biriyani", price: 150 },
          { id: "prawn_biryani", name: "Prawn Biriyani", price: 280 },
          { id: "egg_biryani", name: "Egg Biriyani", price: 120 },
          { id: "plain_biryani", name: "Plain Biriyani (Kuska)", price: 100 },
        ],
      },
      bucket_biryani: {
        label: "🪣 Bucket Biryani",
        items: [
          { id: "bucket_mutton_full", name: "Bucket Mutton Full (8 Persons)", price: 2700 },
          { id: "bucket_mutton_half", name: "Bucket Mutton Half (4 Persons)", price: 1500 },
          { id: "bucket_chicken_full", name: "Bucket Chicken Full (8 Persons)", price: 2100 },
          { id: "bucket_chicken_half", name: "Bucket Chicken Half (4 Persons)", price: 1200 },
        ],
      },
    },
  },
  dry_gravy: {
    label: "🫕 Dry / Fry & Gravy",
    subcategories: {
      veg_dry: {
        label: "🥦 Veg Dry & Gravy",
        items: [
          { id: "gobi_man_dry", name: "Gobi Manchurian Dry", price: 180 },
          { id: "paneer_man_dry", name: "Paneer Manchurian Dry", price: 180 },
          { id: "kadai_paneer", name: "Kadai Paneer", price: 180 },
          { id: "paneer_butter_masala", name: "Paneer Butter Masala", price: 200 },
        ],
      },
      nonveg_dry: {
        label: "🍗 Non-Veg Dry & Gravy",
        items: [
          { id: "mutton_sukka", name: "Mutton Sukka", price: 220 },
          { id: "karaikudi_sukka", name: "Karaikudi Chicken Sukka", price: 180 },
          { id: "pepper_chicken_dry", name: "Pepper Chicken Dry", price: 200 },
          { id: "chilly_chicken_dry", name: "Chilly Chicken Dry", price: 200 },
          { id: "chettinad_chicken_gravy", name: "Chettinadu Chicken Gravy", price: 220 },
          { id: "mutton_masala_bone", name: "Mutton Masala Bone", price: 300 },
          { id: "manchatti_meen", name: "Manchatti Meen Kuzhambu", price: 160 },
        ],
      },
    },
  },
  seafood: {
    label: "🦞 Sea Foods",
    subcategories: {
      fish: {
        label: "🐟 Fish Items",
        items: [
          { id: "nethili_fish_fry", name: "Nethili Fish Fry", price: 160 },
          { id: "vanjaram_masala", name: "Vanjaram Fish Masala", price: 180 },
          { id: "meen_polichathu", name: "Meen Polichathu", price: 250 },
          { id: "special_fish_fry", name: "Special Fish Fry", price: 300 },
          { id: "crab_masala", name: "Crab Masala", price: 300 },
        ],
      },
      prawns: {
        label: "🦐 Prawns & Others",
        items: [
          { id: "prawns_fry", name: "Prawns Fry", price: 200 },
          { id: "prawns_masala", name: "Prawns Masala", price: 250 },
          { id: "prawns_pepper_fry", name: "Prawns Pepper Fry", price: 230 },
          { id: "squid_masala", name: "Squid Masala", price: 220 },
        ],
      },
    },
  },
  breads: {
    label: "🫓 Indian Breads & Noodles",
    subcategories: {
      breads: {
        label: "🫓 Indian Breads",
        items: [
          { id: "parotta_set", name: "Parotta Set", price: 50 },
          { id: "egg_kothu_parotta", name: "Egg Kothu Parotta", price: 140 },
          { id: "chicken_kothu_parotta", name: "Chicken Kothu Parotta", price: 180 },
          { id: "butter_naan", name: "Butter Naan", price: 70 },
          { id: "garlic_kulcha", name: "Garlic Kulcha", price: 80 },
        ],
      },
      noodles: {
        label: "🍜 Noodles",
        items: [
          { id: "veg_noodles", name: "Veg Noodles", price: 120 },
          { id: "chicken_noodles", name: "Chicken Noodles", price: 160 },
          { id: "prawns_noodles", name: "Prawns Noodles", price: 200 },
          { id: "mixed_noodles", name: "Mixed Noodles", price: 220 },
        ],
      },
    },
  },
  rice_tiffin: {
    label: "🍚 Fried Rice & Tiffin",
    subcategories: {
      fried_rice: {
        label: "🍚 Fried Rice",
        items: [
          { id: "veg_fried_rice", name: "Veg Fried Rice", price: 120 },
          { id: "chicken_fried_rice", name: "Chicken Fried Rice", price: 160 },
          { id: "prawns_fried_rice", name: "Prawns Fried Rice", price: 200 },
          { id: "schezwan_chicken_fried_rice", name: "Schezwan Chicken Fried Rice", price: 180 },
        ],
      },
      tiffin: {
        label: "🥞 Tiffin",
        items: [
          { id: "plain_dosa", name: "Plain Dosa", price: 50 },
          { id: "ghee_roast", name: "Ghee Roast", price: 70 },
          { id: "onion_uthappam", name: "Onion Uthappam", price: 70 },
          { id: "egg_dosai", name: "Egg Dosai", price: 70 },
          { id: "idly_2pcs", name: "Idly (2pcs)", price: 30 },
        ],
      },
    },
  },
  meals_eggies: {
    label: "🍽️ Meals & Eggies",
    subcategories: {
      meals: {
        label: "🍽️ Meals",
        items: [
          { id: "veg_meals", name: "Veg Meals (Full)", price: 120 },
          { id: "non_veg_meals", name: "Non Veg Meals (Full)", price: 140 },
        ],
      },
      eggies: {
        label: "🥚 Eggies",
        items: [
          { id: "omelette", name: "Omelette", price: 25 },
          { id: "egg_masala", name: "Egg Masala", price: 120 },
          { id: "egg_burji", name: "Egg Burji", price: 70 },
          { id: "masala_kalakki", name: "Masala Kalakki", price: 30 },
        ],
      },
    },
  },
};

// ─────────────────────────────────────────────────────────
// HELPER: Find item by ID
// ─────────────────────────────────────────────────────────
function findItem(itemId) {
  for (const cat of Object.values(MENU)) {
    for (const sub of Object.values(cat.subcategories)) {
      const item = sub.items.find((i) => i.id === itemId);
      if (item) return item;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────
// HELPER: Build cart message
// ─────────────────────────────────────────────────────────
function buildCartMsg(cart) {
  if (!cart || cart.length === 0) return "🛒 Your cart is empty!";
  let msg = "🛒 *Your Cart*\n─────────────────\n";
  cart.forEach((item, i) => {
    msg += `${i + 1}. ${item.name}\n   ${item.qty} × ₹${item.price} = ₹${item.price * item.qty}\n`;
  });
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  msg += `─────────────────\n💰 *Total: ₹${total}*`;
  return msg;
}

// ─────────────────────────────────────────────────────────
// SEND: Main Menu Categories
// ─────────────────────────────────────────────────────────
async function sendMainMenu(to) {
  const rows = Object.entries(MENU).map(([key, cat]) => ({
    id: `CAT_${key}`,
    title: cat.label,
    description: `Tap to browse`,
  }));
  await sendList(
    to,
    "🍽️ Kavi Chettinadu Restaurant",
    "Select a category to explore our menu:",
    "Browse Menu",
    [{ title: "Menu Categories", rows }]
  );
}

// ─────────────────────────────────────────────────────────
// SEND: Subcategories
// ─────────────────────────────────────────────────────────
async function sendSubcategories(to, catKey) {
  const cat = MENU[catKey];
  if (!cat) return;
  const rows = Object.entries(cat.subcategories).map(([key, sub]) => ({
    id: `SUB_${catKey}___${key}`,
    title: sub.label,
    description: `${sub.items.length} items`,
  }));
  await sendList(
    to,
    cat.label,
    "Select a subcategory:",
    "View Items",
    [{ title: cat.label, rows }]
  );
}

// ─────────────────────────────────────────────────────────
// SEND: Items list
// ─────────────────────────────────────────────────────────
async function sendItems(to, catKey, subKey) {
  const sub = MENU[catKey]?.subcategories[subKey];
  if (!sub) return;
  const rows = sub.items.map((item) => ({
    id: `ITEM_${item.id}`,
    title: item.name,
    description: `Rs.${item.price}`,
  }));
  await sendList(
    to,
    sub.label,
    "Select an item to add to cart:",
    "Choose Item",
    [{ title: sub.label, rows }]
  );
}

// ─────────────────────────────────────────────────────────
// SEND: Quantity selection
// ─────────────────────────────────────────────────────────
async function sendQuantitySelect(to, item) {
  await sendButtons(
    to,
    `*${item.name}*\n💰 Price: Rs.${item.price}\n\nSelect quantity:`,
    [
      { id: `QTY_1___${item.id}`, title: "1️⃣  Qty: 1" },
      { id: `QTY_2___${item.id}`, title: "2️⃣  Qty: 2" },
      { id: `QTY_3___${item.id}`, title: "3️⃣  Qty: 3" },
    ]
  );
}

// ─────────────────────────────────────────────────────────
// SEND: After add to cart
// ─────────────────────────────────────────────────────────
async function sendAfterAddToCart(to, cart) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  await sendButtons(
    to,
    `✅ *Item added to cart!*\n\n🛒 Cart Total: Rs.${total}\n\nWhat would you like to do?`,
    [
      { id: "ADD_MORE", title: "➕ Add More Items" },
      { id: "VIEW_CART", title: "🛒 View Cart" },
      { id: "PLACE_ORDER", title: "✅ Place Order" },
    ]
  );
}

// ─────────────────────────────────────────────────────────
// SEND: Order type
// ─────────────────────────────────────────────────────────
async function sendOrderType(to) {
  await sendButtons(
    to,
    "🚚 *Select Order Type:*",
    [
      { id: "OT_DELIVERY", title: "🚚 Home Delivery" },
      { id: "OT_TAKEAWAY", title: "🥡 Take Away" },
      { id: "OT_DINE_IN", title: "🍽️ Dine In" },
    ]
  );
}

// ─────────────────────────────────────────────────────────
// SEND: Payment method
// ─────────────────────────────────────────────────────────
async function sendPaymentMethod(to, total) {
  await sendButtons(
    to,
    `💰 *Total Amount: Rs.${total}*\n\nSelect payment method:`,
    [
      { id: "PAY_COD", title: "💵 Cash on Delivery" },
      { id: "PAY_UPI", title: "📲 UPI Payment" },
      { id: "PAY_CARD", title: "💳 Card Payment" },
    ]
  );
}

// ─────────────────────────────────────────────────────────
// SEND: Order Summary
// ─────────────────────────────────────────────────────────
async function sendOrderSummary(to, session) {
  const cart = session.cart;
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const { name, phone, address, orderType, paymentMethod } = session.deliveryData;

  const itemsList = cart.map((i) => `• ${i.name} x${i.qty} = Rs.${i.price * i.qty}`).join("\n");

  const orderTypeLabel =
    orderType === "OT_DELIVERY" ? "🚚 Home Delivery" :
    orderType === "OT_TAKEAWAY" ? "🥡 Take Away" : "🍽️ Dine In";

  const payLabel =
    paymentMethod === "PAY_COD" ? "💵 Cash on Delivery" :
    paymentMethod === "PAY_UPI" ? "📲 UPI Payment" : "💳 Card Payment";

  await sendButtons(
    to,
    `📋 *Order Summary*\n─────────────────\n` +
    `👤 *Name:* ${name}\n` +
    `📞 *Phone:* ${phone}\n` +
    `🚚 *Type:* ${orderTypeLabel}\n` +
    `🏠 *Address:* ${address || "N/A"}\n` +
    `💳 *Payment:* ${payLabel}\n` +
    `─────────────────\n` +
    `*Items:*\n${itemsList}\n` +
    `─────────────────\n` +
    `💰 *Total: Rs.${total}*\n\nConfirm your order?`,
    [
      { id: "CONFIRM_ORDER", title: "✅ Confirm Order" },
      { id: "MODIFY_ORDER", title: "✏️ Modify Order" },
    ]
  );
}

// ─────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────
const handleMessage = async (from, messageBody, interactiveReply, locationData, catalogueOrder) => {
  try {
    let session = await Session.findOne({ phoneNumber: from });
    if (!session) {
      session = new Session({ phoneNumber: from, state: "WELCOME", cart: [] });
      await session.save();
    }
    if (!session.cart) session.cart = [];
    if (!session.deliveryData) session.deliveryData = {};
    session.lastActivity = new Date();

    const input = interactiveReply?.id || messageBody?.trim()?.toLowerCase();
    const rawInput = messageBody?.trim();

    console.log(`📥 From: ${from} | Input: ${input} | State: ${session.state} | Step: ${session.deliveryStep}`);

    // ── EXIT ──────────────────────────────────────────────
    if (["exit", "bye", "quit"].includes(input)) {
      session.state = "WELCOME";
      session.cart = [];
      session.deliveryData = {};
      session.deliveryStep = null;
      session.markModified("cart");
      session.markModified("deliveryData");
      await session.save();
      await sendText(from, "👋 Thank you for visiting Kavi Chettinadu Restaurant!\n\nSend *hi* anytime to order again. 🍛");
      return;
    }

    // ── GREETING ──────────────────────────────────────────
    if (["hi", "hello", "hey", "start", "menu"].includes(input)) {
      session.state = "MAIN_MENU";
      session.cart = [];
      session.deliveryData = {};
      session.deliveryStep = null;
      session.markModified("cart");
      session.markModified("deliveryData");
      await session.save();
      await sendButtons(
        from,
        `👋 *Welcome to Kavi Chettinadu Restaurant!* 🍛\n\n_Taste The Tradition_ ✨\n\nAuthentic Chettinadu flavours from Rameswaram!\n\nWould you like to browse our menu?`,
        [
          { id: "BROWSE_MENU", title: "✅ Yes, Show Menu" },
          { id: "exit", title: "❌ No, Exit" },
        ]
      );
      return;
    }

    // ── BROWSE MENU ───────────────────────────────────────
    if (["BROWSE_MENU", "ADD_MORE", "MAIN_MENU"].includes(input)) {
      session.state = "CATEGORY_SELECT";
      await session.save();
      await sendMainMenu(from);
      return;
    }

    // ── CATEGORY SELECT ───────────────────────────────────
    if (input?.startsWith("CAT_")) {
      const catKey = input.replace("CAT_", "");
      session.currentCategory = catKey;
      session.state = "SUBCATEGORY_SELECT";
      await session.save();
      await sendSubcategories(from, catKey);
      return;
    }

    // ── SUBCATEGORY SELECT ────────────────────────────────
    if (input?.startsWith("SUB_")) {
      const withoutPrefix = input.replace("SUB_", "");
      const sepIdx = withoutPrefix.indexOf("___");
      const catKey = withoutPrefix.substring(0, sepIdx);
      const subKey = withoutPrefix.substring(sepIdx + 3);
      session.currentCategory = catKey;
      session.currentSubcategory = subKey;
      session.state = "ITEM_SELECT";
      await session.save();
      await sendItems(from, catKey, subKey);
      return;
    }

    // ── ITEM SELECT ───────────────────────────────────────
    if (input?.startsWith("ITEM_")) {
      const itemId = input.replace("ITEM_", "");
      const item = findItem(itemId);
      if (!item) { await sendText(from, "❌ Item not found. Please try again."); return; }
      session.pendingItem = { id: item.id, name: item.name, price: item.price };
      session.state = "QUANTITY_SELECT";
      session.markModified("pendingItem");
      await session.save();
      await sendQuantitySelect(from, item);
      return;
    }

    // ── QUANTITY SELECT ───────────────────────────────────
    if (input?.startsWith("QTY_")) {
      const withoutPrefix = input.replace("QTY_", "");
      const sepIdx = withoutPrefix.indexOf("___");
      const qty = parseInt(withoutPrefix.substring(0, sepIdx));
      const itemId = withoutPrefix.substring(sepIdx + 3);
      const item = findItem(itemId) || session.pendingItem;

      if (!item) { await sendText(from, "❌ Error. Please try again."); return; }

      const existing = session.cart.findIndex((c) => c.itemId === item.id);
      if (existing >= 0) {
        session.cart[existing].qty += qty;
      } else {
        session.cart.push({ itemId: item.id, name: item.name, price: item.price, qty });
      }
      session.pendingItem = null;
      session.state = "CART";
      session.markModified("cart");
      await session.save();
      await sendAfterAddToCart(from, session.cart);
      return;
    }

    // ── VIEW CART ─────────────────────────────────────────
    if (input === "VIEW_CART") {
      const cartMsg = buildCartMsg(session.cart);
      if (!session.cart || session.cart.length === 0) {
        await sendButtons(from, cartMsg, [
          { id: "BROWSE_MENU", title: "🍴 Browse Menu" },
          { id: "exit", title: "❌ Exit" },
        ]);
      } else {
        await sendButtons(from, cartMsg, [
          { id: "ADD_MORE", title: "➕ Add More" },
          { id: "PLACE_ORDER", title: "✅ Place Order" },
          { id: "CLEAR_CART", title: "🗑️ Clear Cart" },
        ]);
      }
      return;
    }

    // ── CLEAR CART ────────────────────────────────────────
    if (input === "CLEAR_CART") {
      session.cart = [];
      session.markModified("cart");
      await session.save();
      await sendButtons(from, "🗑️ Cart cleared!", [
        { id: "BROWSE_MENU", title: "🍴 Browse Menu" },
        { id: "exit", title: "❌ Exit" },
      ]);
      return;
    }

    // ── PLACE ORDER ───────────────────────────────────────
    if (["PLACE_ORDER", "PLACE_ORDER_FLOW"].includes(input)) {
      if (!session.cart || session.cart.length === 0) {
        await sendButtons(from, "❌ Your cart is empty!", [{ id: "BROWSE_MENU", title: "🍴 Browse Menu" }]);
        return;
      }
      session.state = "COLLECT_DETAILS";
      session.deliveryStep = "name";
      session.deliveryData = {};
      session.markModified("deliveryData");
      await session.save();
      await sendText(from, "📝 *Let's confirm your details!*\n\n👤 Please enter your *full name:*");
      return;
    }

    // ── COLLECT: Name ─────────────────────────────────────
    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === "name") {
      session.deliveryData.name = rawInput || "Customer";
      session.deliveryStep = "phone";
      session.markModified("deliveryData");
      await session.save();
      await sendText(from, `✅ Name: *${session.deliveryData.name}*\n\n📞 Please enter your *phone number:*`);
      return;
    }

    // ── COLLECT: Phone ────────────────────────────────────
    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === "phone") {
      let phone = rawInput?.replace(/\D/g, "") || "";
      if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
      if (!/^\d{10}$/.test(phone)) {
        await sendText(from, "❌ Invalid number. Please enter a valid *10-digit mobile number:*");
        return;
      }
      session.deliveryData.phone = phone;
      session.deliveryStep = "order_type";
      session.markModified("deliveryData");
      await session.save();
      await sendOrderType(from);
      return;
    }

    // ── ORDER TYPE ────────────────────────────────────────
    if (["OT_DELIVERY", "OT_TAKEAWAY", "OT_DINE_IN"].includes(input)) {
      session.deliveryData.orderType = input;
      session.markModified("deliveryData");

      if (input === "OT_DELIVERY") {
        session.deliveryStep = "address";
        await session.save();
        await sendButtons(
          from,
          "🏠 *Delivery Address*\n\nHow would you like to share your address?",
          [
            { id: "ADDR_LOCATION", title: "📍 Share Location" },
            { id: "ADDR_MANUAL", title: "✏️ Enter Manually" },
          ]
        );
      } else {
        session.deliveryData.address = input === "OT_TAKEAWAY" ? "Takeaway - Pick up at restaurant" : "Dine In";
        session.deliveryStep = "payment";
        await session.save();
        const total = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
        await sendPaymentMethod(from, total);
      }
      return;
    }

    // ── ADDRESS: Location ─────────────────────────────────
    if (input === "ADDR_LOCATION") {
      await sendText(from, "📍 Please share your *live location* using WhatsApp attachment (📎) → Location");
      return;
    }

    if (locationData && session.state === "COLLECT_DETAILS") {
      const addr = locationData.address || `https://maps.google.com/?q=${locationData.lat},${locationData.lng}`;
      session.deliveryData.address = addr;
      session.deliveryStep = "payment";
      session.markModified("deliveryData");
      await session.save();
      const total = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
      await sendText(from, "✅ Location saved!");
      await sendPaymentMethod(from, total);
      return;
    }

    // ── ADDRESS: Manual ───────────────────────────────────
    if (input === "ADDR_MANUAL") {
      session.deliveryStep = "address_manual";
      await session.save();
      await sendText(from, "✏️ Please enter your *full delivery address:*\n_(House No, Street, Area, Landmark, Pincode)_");
      return;
    }

    if (session.state === "COLLECT_DETAILS" && session.deliveryStep === "address_manual") {
      session.deliveryData.address = rawInput || "";
      session.deliveryStep = "payment";
      session.markModified("deliveryData");
      await session.save();
      const total = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
      await sendText(from, "✅ Address saved!");
      await sendPaymentMethod(from, total);
      return;
    }

    // ── PAYMENT ───────────────────────────────────────────
    if (["PAY_COD", "PAY_UPI", "PAY_CARD"].includes(input)) {
      session.deliveryData.paymentMethod = input;
      session.state = "ORDER_SUMMARY";
      session.deliveryStep = null;
      session.markModified("deliveryData");
      await session.save();

      if (input === "PAY_UPI") {
        const total = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
        const upiId = process.env.RESTAURANT_UPI_ID || "kaviyakiruthi22@okhdfcbank";
        await sendText(from, `📲 *UPI Payment Details*\n\n💳 UPI ID: *${upiId}*\n💰 Amount: *Rs.${total}*\n\nPlease complete the payment and confirm below.`);
        await sendButtons(from, "Have you completed the UPI payment?", [
          { id: "UPI_DONE", title: "✅ Payment Done" },
          { id: "PAY_COD", title: "💵 Pay COD instead" },
        ]);
        return;
      }

      if (input === "PAY_CARD") {
        await sendText(from, "💳 *Card payment will be collected at delivery/counter.*");
      }

      await sendOrderSummary(from, session);
      return;
    }

    // ── UPI DONE ──────────────────────────────────────────
    if (input === "UPI_DONE") {
      session.deliveryData.paymentMethod = "PAY_UPI";
      session.state = "ORDER_SUMMARY";
      session.markModified("deliveryData");
      await session.save();
      await sendOrderSummary(from, session);
      return;
    }

    // ── MODIFY ORDER ──────────────────────────────────────
    if (input === "MODIFY_ORDER") {
      session.state = "CART";
      await session.save();
      await sendButtons(from, buildCartMsg(session.cart), [
        { id: "ADD_MORE", title: "➕ Add More" },
        { id: "CLEAR_CART", title: "🗑️ Clear Cart" },
        { id: "PLACE_ORDER", title: "✅ Place Order" },
      ]);
      return;
    }

    // ── CONFIRM ORDER ─────────────────────────────────────
    if (input === "CONFIRM_ORDER") {
      const { name, phone, address, orderType, paymentMethod } = session.deliveryData;
      const total = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
      const orderId = "KAV" + Date.now();

      const orderTypeLabel =
        orderType === "OT_DELIVERY" ? "Home Delivery" :
        orderType === "OT_TAKEAWAY" ? "Take Away" : "Dine In";

      const payLabel =
        paymentMethod === "PAY_COD" ? "Cash on Delivery" :
        paymentMethod === "PAY_UPI" ? "UPI Payment" : "Card Payment";

      const newOrder = new Order({
        orderId,
        phone: phone || from,
        name: name || "Customer",
        address: address || orderTypeLabel,
        items: session.cart.map((i) => ({ name: i.name, price: i.price, quantity: i.qty })),
        totalAmount: total,
        paymentMethod: payLabel,
        status: "confirmed",
      });
      await newOrder.save();
      console.log(`✅ Order: ${orderId} | Total: Rs.${total}`);

      // Reset session
      session.cart = [];
      session.deliveryData = {};
      session.deliveryStep = null;
      session.state = "WELCOME";
      session.markModified("cart");
      session.markModified("deliveryData");
      await session.save();

      const itemsList = newOrder.items.map((i) => `• ${i.name} x${i.quantity} = Rs.${i.price * i.quantity}`).join("\n");

      await sendButtons(
        from,
        `🎉 *Order Placed Successfully!*\n\n` +
        `📋 *Order ID:* #${orderId}\n` +
        `─────────────────\n` +
        `*Items:*\n${itemsList}\n` +
        `─────────────────\n` +
        `💰 *Total: Rs.${total}*\n` +
        `💳 *Payment:* ${payLabel}\n` +
        `🚚 *Type:* ${orderTypeLabel}\n` +
        `🏠 *Address:* ${address || orderTypeLabel}\n` +
        `─────────────────\n` +
        `⏱️ *Estimated Time:* 30-45 mins\n\n` +
        `Thank you for ordering from Kavi Chettinadu! 🙏`,
        [
          { id: "BROWSE_MENU", title: "🔄 Order Again" },
          { id: "exit", title: "❌ Exit" },
        ]
      );
      return;
    }

    // ── FALLBACK ──────────────────────────────────────────
    await sendButtons(
      from,
      `🤔 I didn't understand that.\n\nSend *hi* to start ordering!`,
      [
        { id: "hi", title: "🍴 Start Ordering" },
        { id: "VIEW_CART", title: "🛒 View Cart" },
        { id: "exit", title: "❌ Exit" },
      ]
    );

  } catch (err) {
    console.error("❌ handleMessage Error:", err.message);
  }
};

module.exports = { handleMessage };