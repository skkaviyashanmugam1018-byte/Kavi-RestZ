const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Order = require("../models/Order");
const { sendOrderConfirmation } = require("../config/whatsapp");

// ── Load Private Key ──────────────────────────────────────
const privateKey = fs.readFileSync(
  path.join(__dirname, "../private.pem"),
  "utf8"
);

// ── Decrypt Request from Meta ─────────────────────────────
function decryptRequest(body) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64")
  );

  const iv = Buffer.from(initial_vector, "base64");
  const encryptedData = Buffer.from(encrypted_flow_data, "base64");
  const TAG_LENGTH = 16;
  const encryptedBody = encryptedData.slice(0, -TAG_LENGTH);
  const authTag = encryptedData.slice(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-128-gcm", decryptedAesKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted =
    decipher.update(encryptedBody, undefined, "utf8") + decipher.final("utf8");

  return {
    decryptedBody: JSON.parse(decrypted),
    aesKey: decryptedAesKey,
    iv,
  };
}

// ── Encrypt Response to Meta ──────────────────────────────
function encryptResponse(response, aesKey, iv) {
  const flippedIv = Buffer.alloc(iv.length);
  for (let i = 0; i < iv.length; i++) {
    flippedIv[i] = ~iv[i];
  }

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(response), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return encrypted.toString("base64");
}

// ── Price Map (Flow-ல் select பண்ண ID → name & price) ────
// Flow-ல் வர்ற item IDs-ஐ இங்க match பண்ணி price எடுக்கோம்
const ITEM_PRICE_MAP = {
  // Soup - Veg
  hot_sour_veg:        { name: "Hot & Sour Veg Soup",           price: 80  },
  sweet_corn_veg:      { name: "Sweet Corn Veg Soup",           price: 80  },
  clear_soup:          { name: "Clear Soup",                    price: 80  },
  // Soup - Non-Veg
  crab_soup:           { name: "Crab Soup",                     price: 120 },
  hs_chicken_soup:     { name: "Hot & Sour Chicken Soup",       price: 100 },
  chicken_clear_soup:  { name: "Chicken Clear Soup",            price: 100 },
  // Starters - Veg
  french_fries:        { name: "French Fries",                  price: 120 },
  gobi_65:             { name: "Gobi 65",                       price: 150 },
  mushroom_65:         { name: "Mushroom 65",                   price: 150 },
  paneer_tikka:        { name: "Paneer Tikka",                  price: 160 },
  // Starters - Non-Veg
  chilly_chicken_bl:   { name: "Chilly Chicken BL",             price: 200 },
  chicken_tikka:       { name: "Chicken Tikka",                 price: 180 },
  chicken_65_bl:       { name: "Chicken 65 BL",                 price: 200 },
  chicken_65_wb:       { name: "Chicken 65 WB",                 price: 170 },
  honey_chicken:       { name: "Honey Chicken",                 price: 220 },
  chicken_lolly_pop:   { name: "Chicken Lolly Pop 5pcs",        price: 200 },
  dragon_chicken:      { name: "Dragon Chicken",                price: 200 },
  chicken_kola_urundai:{ name: "Chicken Kola Urundai",          price: 160 },
  alfaham_chicken:     { name: "Alfaham Chicken",               price: 200 },
  // BBQ / Grill
  grill_full:          { name: "Grill Chicken - Full",          price: 460 },
  grill_half:          { name: "Grill Chicken - Half",          price: 240 },
  grill_quarter:       { name: "Grill Chicken - Quarter",       price: 130 },
  bbq_full:            { name: "BBQ Chicken - Full",            price: 480 },
  bbq_half:            { name: "BBQ Chicken - Half",            price: 250 },
  bbq_quarter:         { name: "BBQ Chicken - Quarter",         price: 130 },
  bbq_juicy_wings:     { name: "BBQ Juicy Wings 5pcs",          price: 200 },
  bbq_boneless:        { name: "BBQ Boneless Strips 5pcs",      price: 180 },
  bbq_drumstick:       { name: "BBQ Drumstick 2pcs",            price: 180 },
  // Tandoori
  tand_full:           { name: "Tandoori Chicken - Full",       price: 480 },
  tand_half:           { name: "Tandoori Chicken - Half",       price: 250 },
  tand_quarter:        { name: "Tandoori Chicken - Quarter",    price: 130 },
  chicken_tikka_7pcs:  { name: "Chicken Tikka 7pcs",            price: 220 },
  drumstick_4pcs:      { name: "Drumstick Chicken 4pcs",        price: 280 },
  tand_pomfret:        { name: "Tandoori Pomfret Fish",         price: 360 },
  tand_platter:        { name: "Tandoori Platter",              price: 500 },
  fish_tikka:          { name: "Fish Tikka",                    price: 200 },
  prawns_tikka:        { name: "Prawns Tikka",                  price: 240 },
  // Fried Chicken
  bucket_5pcs:         { name: "Bucket 5pcs",                   price: 450 },
  bucket_10pcs:        { name: "Bucket 10pcs",                  price: 880 },
  lolipop_5pcs:        { name: "Lolipop 5pcs",                  price: 250 },
  wings_5pcs:          { name: "Wings 5pcs",                    price: 230 },
  boneless_strips:     { name: "Boneless Strips 5pcs",          price: 200 },
  popcorn:             { name: "Popcorn",                       price: 160 },
  // Biryani
  mutton_biryani:      { name: "Mutton Biriyani",               price: 280 },
  chicken_biryani:     { name: "Chicken Biriyani",              price: 150 },
  prawn_biryani:       { name: "Prawn Biriyani",                price: 280 },
  egg_biryani:         { name: "Egg Biriyani",                  price: 120 },
  plain_biryani:       { name: "Plain Biriyani (Kuska)",        price: 100 },
  bucket_mutton_full:  { name: "Bucket Mutton Full (8 Persons)",price: 2700},
  bucket_mutton_half:  { name: "Bucket Mutton Half (4 Persons)",price: 1500},
  bucket_chicken_full: { name: "Bucket Chicken Full (8 Persons)",price:2100},
  bucket_chicken_half: { name: "Bucket Chicken Half (4 Persons)",price:1200},
  // Dry / Fry - Veg
  gobi_man_dry:        { name: "Gobi Manchurian Dry",           price: 180 },
  paneer_man_dry:      { name: "Paneer Manchurian Dry",         price: 180 },
  mushroom_man_dry:    { name: "Mushroom Manchurian Dry",       price: 180 },
  // Dry / Fry - NonVeg
  mutton_sukka:        { name: "Mutton Sukka",                  price: 220 },
  karaikudi_sukka:     { name: "Karaikudi Chicken Sukka",       price: 180 },
  era_thokku:          { name: "Era Thokku",                    price: 200 },
  chicken_chettinad:   { name: "Chicken Chettinadu Masala",     price: 220 },
  pepper_chicken_dry:  { name: "Pepper Chicken Dry",            price: 200 },
  chilly_chicken_dry:  { name: "Chilly Chicken Dry",            price: 200 },
  schezwan_chicken:    { name: "Schezwan Chicken",              price: 210 },
  egg_pepper_fry:      { name: "Egg Pepper Fry",                price: 120 },
  // Gravy - Veg
  gobi_man_gravy:      { name: "Gobi Manchurian Gravy",         price: 170 },
  paneer_man_gravy:    { name: "Paneer Manchurian Gravy",       price: 180 },
  mushroom_man_gravy:  { name: "Mushroom Manchurian Gravy",     price: 180 },
  veg_kadai:           { name: "Veg Kadai",                     price: 180 },
  kadai_paneer:        { name: "Kadai Paneer",                  price: 180 },
  dal_fry:             { name: "Dal Fry",                       price: 180 },
  paneer_butter_masala:{ name: "Paneer Butter Masala",          price: 200 },
  aloo_gobi_masala:    { name: "Aloo Gobi Masala",              price: 180 },
  veg_mixed_curry:     { name: "Veg Mixed Curry",               price: 180 },
  // Gravy - NonVeg
  butter_chicken_bl:   { name: "Butter Chicken Masala BL",      price: 220 },
  chicken_tikka_masala_bl:{ name: "Chicken Tikka Masala BL",    price: 220 },
  malabar_chicken_bl:  { name: "Malabar Chicken Masala BL",     price: 220 },
  pepper_chicken_gravy:{ name: "Pepper Chicken Gravy",          price: 220 },
  chettinad_chicken_gravy:{ name: "Chettinadu Chicken Gravy",   price: 220 },
  kadai_chicken_gravy: { name: "Kadai Chicken Gravy",           price: 220 },
  chicken_man_gravy_bl:{ name: "Chicken Manchurian Gravy BL",   price: 220 },
  chinese_chilly_chicken:{ name: "Chinese Chilly Chicken Gravy",price: 240 },
  schezwan_chicken_gravy:{ name: "Schezwan Chicken Gravy",      price: 220 },
  mutton_masala_bone:  { name: "Mutton Masala Bone",            price: 300 },
  manchatti_meen:      { name: "Manchatti Meen Kuzhambu",       price: 160 },
  // Seafood
  chilly_fish:         { name: "Chilly Fish",                   price: 200 },
  fish_finger:         { name: "Fish Finger",                   price: 250 },
  nethili_fish_fry:    { name: "Nethili Fish Fry",              price: 160 },
  dhanushkodi_roast:   { name: "Dhanushkodi Fish Roast",        price: 200 },
  tawa_vanjaram_fry:   { name: "Tawa Vanjaram Fry",             price: 150 },
  vanjaram_masala:     { name: "Vanjaram Fish Masala",          price: 180 },
  vila_meen_fry:       { name: "Vila Meen Fish Fry",            price: 160 },
  vaval_fish_fry:      { name: "Vaval Fish Fry",                price: 250 },
  crab_masala:         { name: "Crab Masala",                   price: 300 },
  meen_polichathu:     { name: "Meen Polichathu",               price: 250 },
  special_fish_fry:    { name: "Special Fish Fry",              price: 300 },
  boiled_fish_2:       { name: "Boiled Fish (2 Fish)",          price: 300 },
  prawns_fry:          { name: "Prawns Fry",                    price: 200 },
  prawns_65:           { name: "Prawns 65",                     price: 220 },
  prawns_pepper_fry:   { name: "Prawns Pepper Fry",             price: 230 },
  prawns_masala:       { name: "Prawns Masala",                 price: 250 },
  squid_masala:        { name: "Squid Masala",                  price: 220 },
  squid_fry:           { name: "Squid Fry",                     price: 200 },
  prawn_popcorn:       { name: "Prawn Popcorn",                 price: 250 },
  // Breads
  chappathi_set:       { name: "Chappathi Set",                 price: 50  },
  parotta_set:         { name: "Parotta Set",                   price: 50  },
  veechu_parotta:      { name: "Veechu Parotta",                price: 50  },
  egg_veechu_parotta:  { name: "Egg Veechu Parotta",            price: 70  },
  egg_kothu_parotta:   { name: "Egg Kothu Parotta",             price: 140 },
  chicken_kothu_parotta:{ name: "Chicken Kothu Parotta",        price: 180 },
  chilly_parotta:      { name: "Chilly Parotta",                price: 130 },
  ceylon_chicken_parotta:{ name: "Ceylon Chicken Parotta",      price: 150 },
  naan:                { name: "Naan",                          price: 60  },
  butter_naan:         { name: "Butter Naan",                   price: 70  },
  rotti:               { name: "Rotti",                         price: 40  },
  butter_rotti:        { name: "Butter Rotti",                  price: 50  },
  pulka_2pcs:          { name: "Pulka 2pcs",                    price: 50  },
  kulcha:              { name: "Kulcha",                        price: 60  },
  butter_kulcha:       { name: "Butter Kulcha",                 price: 70  },
  garlic_kulcha:       { name: "Garlic Kulcha",                 price: 80  },
  // Noodles
  veg_noodles:         { name: "Veg Noodles",                   price: 120 },
  egg_noodles:         { name: "Egg Noodles",                   price: 140 },
  fish_noodles:        { name: "Fish Noodles",                  price: 180 },
  chicken_noodles:     { name: "Chicken Noodles",               price: 160 },
  prawns_noodles:      { name: "Prawns Noodles",                price: 200 },
  mixed_noodles:       { name: "Mixed Noodles",                 price: 220 },
  schezwan_egg_noodles:{ name: "Schezwan Egg Noodles",          price: 150 },
  schezwan_fish_noodles:{ name: "Schezwan Fish Noodles",        price: 200 },
  schezwan_chicken_noodles:{ name: "Schezwan Chicken Noodles",  price: 180 },
  // Fried Rice
  veg_fried_rice:      { name: "Veg Fried Rice",                price: 120 },
  jeera_fried_rice:    { name: "Jeera Fried Rice",              price: 150 },
  ghee_fried_rice:     { name: "Ghee Fried Rice",               price: 150 },
  egg_fried_rice:      { name: "Egg Fried Rice",                price: 140 },
  chicken_fried_rice:  { name: "Chicken Fried Rice",            price: 160 },
  prawns_fried_rice:   { name: "Prawns Fried Rice",             price: 200 },
  schezwan_egg_fried_rice:{ name: "Schezwan Egg Fried Rice",    price: 150 },
  schezwan_chicken_fried_rice:{ name: "Schezwan Chicken Fried Rice", price: 180 },
  schezwan_prawns_fried_rice:{ name: "Schezwan Prawns Fried Rice",  price: 220 },
  schezwan_mixed_fried_rice: { name: "Schezwan Mixed Meat Fried Rice", price: 220 },
  // Tiffin
  kal_dosa:            { name: "Kal Dosa",                      price: 50  },
  plain_dosa:          { name: "Plain Dosa",                    price: 50  },
  idiyappam_2pcs:      { name: "Idiyappam (2pcs)",              price: 30  },
  plain_roast:         { name: "Plain Roast",                   price: 60  },
  ghee_roast:          { name: "Ghee Roast",                    price: 70  },
  uthappam:            { name: "Uthappam",                      price: 50  },
  onion_uthappam:      { name: "Onion Uthappam",                price: 70  },
  idly_2pcs:           { name: "Idly (2pcs)",                   price: 30  },
  chicken_curry_uthappam:{ name: "Chicken Curry Uthappam",      price: 120 },
  egg_dosai:           { name: "Egg Dosai",                     price: 70  },
  // Meals & Eggies
  veg_meals:           { name: "Veg Meals",                     price: 120 },
  non_veg_meals:       { name: "Non Veg Meals",                 price: 140 },
  omelette:            { name: "Omelette",                      price: 25  },
  egg_burji:           { name: "Egg Burji",                     price: 70  },
  egg_masala:          { name: "Egg Masala",                    price: 120 },
  half_boil:           { name: "Half Boil",                     price: 20  },
  full_boil:           { name: "Full Boil",                     price: 20  },
  boiled_egg_2pcs:     { name: "Boiled Egg 2pcs",               price: 40  },
  double_omelette:     { name: "Double Omelette",               price: 50  },
  masala_kalakki:      { name: "Masala Kalakki",                price: 30  },
};

// ── Flow-ல் வர்ற data-ல் இருந்து items extract பண்ணு ──────
function extractItems(data) {
  const items = [];
  const skipValues = ["none", "none2", "— none —", "", null, undefined];

  for (const [key, value] of Object.entries(data)) {
    // category, note, customer fields skip
    if (["category", "note", "customer_name", "customer_phone",
         "delivery_address", "order_type"].includes(key)) continue;

    const val = String(value || "").toLowerCase().trim();
    if (skipValues.includes(val)) continue;

    // ITEM_PRICE_MAP-ல் இருந்தா add பண்ணு
    const itemInfo = ITEM_PRICE_MAP[val];
    if (itemInfo) {
      items.push({
        name:     itemInfo.name,
        price:    itemInfo.price,
        quantity: 1,
      });
    }
  }
  return items;
}

// ── Flow Endpoint ─────────────────────────────────────────
router.post("/endpoint", async (req, res) => {
  try {
    // ── Meta Health Check Ping (unencrypted) ─────────────
    if (req.body?.action === "ping") {
      return res.send({ data: { status: "active" } });
    }

    // ── Decrypt ──────────────────────────────────────────
    const { decryptedBody, aesKey, iv } = decryptRequest(req.body);
    const { flow_token, data, action, screen } = decryptedBody;

    // ── Encrypted Ping ───────────────────────────────────
    if (action === "ping") {
      return res.send(
        encryptResponse({ data: { status: "active" } }, aesKey, iv)
      );
    }

    console.log("📩 Flow Request:", JSON.stringify(decryptedBody, null, 2));

    // flow_token format: order_<phone>_<timestamp>
    const phone = flow_token?.split("_")[1];

    // ── Screen: CATEGORY_SELECT → go to item screen ──────
    // (Routing Flow-ல் handle ஆகும், backend response தேவையில்லை
    //  ஆனா data_exchange call வந்தா default response அனுப்பு)
    if (screen === "CATEGORY_SELECT") {
      return res.send(
        encryptResponse(
          { screen: "CATEGORY_SELECT", data: {} },
          aesKey,
          iv
        )
      );
    }

    // ── Screen: Any item screen → go to DELIVERY_DETAILS ─
    const itemScreens = [
      "SOUP_ORDER", "STARTERS_ORDER", "BBQ_ORDER", "BIRYANI_ORDER",
      "DRY_GRAVY_ORDER", "SEAFOOD_ORDER", "BREADS_NOODLES_ORDER",
      "FRIED_RICE_TIFFIN_ORDER", "MEALS_EGGIES_ORDER"
    ];

    if (itemScreens.includes(screen)) {
      // items-ஐ data-ல் carry பண்ணி DELIVERY_DETAILS-க்கு போ
      return res.send(
        encryptResponse(
          {
            screen: "DELIVERY_DETAILS",
            data: {
              // item screen data-ஐ delivery screen-க்கு pass பண்ணு
              ...data,
              error_messages: {},
              init_values:    {},
            },
          },
          aesKey,
          iv
        )
      );
    }

    // ── Screen: DELIVERY_DETAILS → go to ORDER_SUMMARY ───
    if (screen === "DELIVERY_DETAILS") {
      const { customer_name, customer_phone, delivery_address, order_type } = data;

      return res.send(
        encryptResponse(
          {
            screen: "ORDER_SUMMARY",
            data: {
              ...data,  // item selections carry forward
              customer_name:    customer_name    || "",
              customer_phone:   customer_phone   || "",
              delivery_address: delivery_address || "",
              order_type:       order_type       || "delivery",
            },
          },
          aesKey,
          iv
        )
      );
    }

    // ── Screen: ORDER_SUMMARY → action: complete → Save Order
    if (action === "data_exchange" && screen === "ORDER_SUMMARY") {
      // இந்த step-ல் இல்லை — complete action webhook வழியா வரும்
      return res.send(
        encryptResponse({ data: { status: "ok" } }, aesKey, iv)
      );
    }

    // ── ACTION: complete (Place Order button tap) ─────────
    if (action === "complete" || action === "COMPLETE") {
      const {
        customer_name,
        customer_phone,
        delivery_address,
        order_type,
        note,
        category,
      } = data;

      // Items extract பண்ணு
      const items = extractItems(data);
      const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

      if (items.length === 0) {
        console.warn("⚠️ No items found in flow completion data");
      }

      // Order ID generate
      const orderId = "KAV" + Date.now();

      // MongoDB-ல் save
      const newOrder = new Order({
        orderId,
        phone:    customer_phone || phone,
        name:     customer_name  || "Customer",
        address:  `${delivery_address || ""} (${order_type || "delivery"})`,
        items,
        totalAmount,
        paymentMethod: "Cash on Delivery", // default; UPI flow தனியா handle பண்ணலாம்
        status: "confirmed",
      });

      await newOrder.save();
      console.log("✅ Flow Order saved:", orderId, "| Items:", items.length, "| Total: ₹" + totalAmount);

      // Customer-க்கு confirmation message அனுப்பு
      if (phone) {
        await sendOrderConfirmation(phone, {
          orderId,
          items,
          totalAmount,
          paymentMethod: "COD",
          orderType: order_type === "dine_in" ? "🍽️ Dine In" :
                     order_type === "takeaway" ? "🏃 Takeaway" : "🛵 Home Delivery",
          address: delivery_address || "",
        });
      }

      // Flow complete response
      return res.send(
        encryptResponse(
          {
            screen: "SUCCESS",
            data:   { order_id: orderId, total: totalAmount },
          },
          aesKey,
          iv
        )
      );
    }

    // ── Default response ──────────────────────────────────
    return res.send(
      encryptResponse(
        { screen: "CATEGORY_SELECT", data: {} },
        aesKey,
        iv
      )
    );

  } catch (err) {
    console.error("❌ Flow Error:", err.message, err.stack);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;