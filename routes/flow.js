const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Order = require("../models/Order");
const { sendOrderConfirmation } = require("../config/whatsapp");

// ── Load Private Key (env variable or file) ───────────────
const privateKey = process.env.PRIVATE_KEY
  ? process.env.PRIVATE_KEY.replace(/\\n/g, "\n")
  : fs.readFileSync(path.join(__dirname, "../private.pem"), "utf8");

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

// ── Price Map ─────────────────────────────────────────────
const ITEM_PRICE_MAP = {
  hot_sour_veg:             { name: "Hot & Sour Veg Soup",              price: 80   },
  sweet_corn_veg:           { name: "Sweet Corn Veg Soup",              price: 80   },
  clear_soup:               { name: "Clear Soup",                       price: 80   },
  crab_soup:                { name: "Crab Soup",                        price: 120  },
  hs_chicken_soup:          { name: "Hot & Sour Chicken Soup",          price: 100  },
  chicken_clear_soup:       { name: "Chicken Clear Soup",               price: 100  },
  french_fries:             { name: "French Fries",                     price: 120  },
  gobi_65:                  { name: "Gobi 65",                          price: 150  },
  mushroom_65:              { name: "Mushroom 65",                      price: 150  },
  paneer_tikka:             { name: "Paneer Tikka",                     price: 160  },
  chilly_chicken_bl:        { name: "Chilly Chicken BL",                price: 200  },
  chicken_tikka:            { name: "Chicken Tikka",                    price: 180  },
  chicken_65_bl:            { name: "Chicken 65 BL",                    price: 200  },
  chicken_65_wb:            { name: "Chicken 65 WB",                    price: 170  },
  honey_chicken:            { name: "Honey Chicken",                    price: 220  },
  chicken_lolly_pop:        { name: "Chicken Lolly Pop 5pcs",           price: 200  },
  dragon_chicken:           { name: "Dragon Chicken",                   price: 200  },
  chicken_kola_urundai:     { name: "Chicken Kola Urundai",             price: 160  },
  alfaham_chicken:          { name: "Alfaham Chicken",                  price: 200  },
  grill_full:               { name: "Grill Chicken - Full",             price: 460  },
  grill_half:               { name: "Grill Chicken - Half",             price: 240  },
  grill_quarter:            { name: "Grill Chicken - Quarter",          price: 130  },
  bbq_full:                 { name: "BBQ Chicken - Full",               price: 480  },
  bbq_half:                 { name: "BBQ Chicken - Half",               price: 250  },
  bbq_quarter:              { name: "BBQ Chicken - Quarter",            price: 130  },
  bbq_juicy_wings:          { name: "BBQ Juicy Wings 5pcs",             price: 200  },
  bbq_boneless:             { name: "BBQ Boneless Strips 5pcs",         price: 180  },
  bbq_drumstick:            { name: "BBQ Drumstick 2pcs",               price: 180  },
  tand_full:                { name: "Tandoori Chicken - Full",          price: 480  },
  tand_half:                { name: "Tandoori Chicken - Half",          price: 250  },
  tand_quarter:             { name: "Tandoori Chicken - Quarter",       price: 130  },
  chicken_tikka_7pcs:       { name: "Chicken Tikka 7pcs",               price: 220  },
  drumstick_4pcs:           { name: "Drumstick Chicken 4pcs",           price: 280  },
  tand_pomfret:             { name: "Tandoori Pomfret Fish",            price: 360  },
  tand_platter:             { name: "Tandoori Platter",                 price: 500  },
  fish_tikka:               { name: "Fish Tikka",                       price: 200  },
  prawns_tikka:             { name: "Prawns Tikka",                     price: 240  },
  bucket_5pcs:              { name: "Bucket 5pcs",                      price: 450  },
  bucket_10pcs:             { name: "Bucket 10pcs",                     price: 880  },
  lolipop_5pcs:             { name: "Lolipop 5pcs",                     price: 250  },
  wings_5pcs:               { name: "Wings 5pcs",                       price: 230  },
  boneless_strips:          { name: "Boneless Strips 5pcs",             price: 200  },
  popcorn:                  { name: "Popcorn",                          price: 160  },
  mutton_biryani:           { name: "Mutton Biriyani",                  price: 280  },
  chicken_biryani:          { name: "Chicken Biriyani",                 price: 150  },
  prawn_biryani:            { name: "Prawn Biriyani",                   price: 280  },
  egg_biryani:              { name: "Egg Biriyani",                     price: 120  },
  plain_biryani:            { name: "Plain Biriyani (Kuska)",           price: 100  },
  bucket_mutton_full:       { name: "Bucket Mutton Full (8 Persons)",   price: 2700 },
  bucket_mutton_half:       { name: "Bucket Mutton Half (4 Persons)",   price: 1500 },
  bucket_chicken_full:      { name: "Bucket Chicken Full (8 Persons)",  price: 2100 },
  bucket_chicken_half:      { name: "Bucket Chicken Half (4 Persons)",  price: 1200 },
  gobi_man_dry:             { name: "Gobi Manchurian Dry",              price: 180  },
  paneer_man_dry:           { name: "Paneer Manchurian Dry",            price: 180  },
  mushroom_man_dry:         { name: "Mushroom Manchurian Dry",          price: 180  },
  mutton_sukka:             { name: "Mutton Sukka",                     price: 220  },
  karaikudi_sukka:          { name: "Karaikudi Chicken Sukka",          price: 180  },
  era_thokku:               { name: "Era Thokku",                       price: 200  },
  chicken_chettinad:        { name: "Chicken Chettinadu Masala",        price: 220  },
  pepper_chicken_dry:       { name: "Pepper Chicken Dry",               price: 200  },
  chilly_chicken_dry:       { name: "Chilly Chicken Dry",               price: 200  },
  schezwan_chicken:         { name: "Schezwan Chicken",                 price: 210  },
  egg_pepper_fry:           { name: "Egg Pepper Fry",                   price: 120  },
  gobi_man_gravy:           { name: "Gobi Manchurian Gravy",            price: 170  },
  paneer_man_gravy:         { name: "Paneer Manchurian Gravy",          price: 180  },
  mushroom_man_gravy:       { name: "Mushroom Manchurian Gravy",        price: 180  },
  veg_kadai:                { name: "Veg Kadai",                        price: 180  },
  kadai_paneer:             { name: "Kadai Paneer",                     price: 180  },
  dal_fry:                  { name: "Dal Fry",                          price: 180  },
  paneer_butter_masala:     { name: "Paneer Butter Masala",             price: 200  },
  aloo_gobi_masala:         { name: "Aloo Gobi Masala",                 price: 180  },
  veg_mixed_curry:          { name: "Veg Mixed Curry",                  price: 180  },
  butter_chicken_bl:        { name: "Butter Chicken Masala BL",         price: 220  },
  chicken_tikka_masala_bl:  { name: "Chicken Tikka Masala BL",          price: 220  },
  malabar_chicken_bl:       { name: "Malabar Chicken Masala BL",        price: 220  },
  pepper_chicken_gravy:     { name: "Pepper Chicken Gravy",             price: 220  },
  chettinad_chicken_gravy:  { name: "Chettinadu Chicken Gravy",         price: 220  },
  kadai_chicken_gravy:      { name: "Kadai Chicken Gravy",              price: 220  },
  chicken_man_gravy_bl:     { name: "Chicken Manchurian Gravy BL",      price: 220  },
  chinese_chilly_chicken:   { name: "Chinese Chilly Chicken Gravy",     price: 240  },
  schezwan_chicken_gravy:   { name: "Schezwan Chicken Gravy",           price: 220  },
  mutton_masala_bone:       { name: "Mutton Masala Bone",               price: 300  },
  manchatti_meen:           { name: "Manchatti Meen Kuzhambu",          price: 160  },
  chilly_fish:              { name: "Chilly Fish",                      price: 200  },
  fish_finger:              { name: "Fish Finger",                      price: 250  },
  nethili_fish_fry:         { name: "Nethili Fish Fry",                 price: 160  },
  dhanushkodi_roast:        { name: "Dhanushkodi Fish Roast",           price: 200  },
  tawa_vanjaram_fry:        { name: "Tawa Vanjaram Fry",                price: 150  },
  vanjaram_masala:          { name: "Vanjaram Fish Masala",             price: 180  },
  vila_meen_fry:            { name: "Vila Meen Fish Fry",               price: 160  },
  vaval_fish_fry:           { name: "Vaval Fish Fry",                   price: 250  },
  crab_masala:              { name: "Crab Masala",                      price: 300  },
  meen_polichathu:          { name: "Meen Polichathu",                  price: 250  },
  special_fish_fry:         { name: "Special Fish Fry",                 price: 300  },
  boiled_fish_2:            { name: "Boiled Fish (2 Fish)",             price: 300  },
  prawns_fry:               { name: "Prawns Fry",                       price: 200  },
  prawns_65:                { name: "Prawns 65",                        price: 220  },
  prawns_pepper_fry:        { name: "Prawns Pepper Fry",                price: 230  },
  prawns_masala:            { name: "Prawns Masala",                    price: 250  },
  squid_masala:             { name: "Squid Masala",                     price: 220  },
  squid_fry:                { name: "Squid Fry",                        price: 200  },
  prawn_popcorn:            { name: "Prawn Popcorn",                    price: 250  },
  chappathi_set:            { name: "Chappathi Set",                    price: 50   },
  parotta_set:              { name: "Parotta Set",                      price: 50   },
  veechu_parotta:           { name: "Veechu Parotta",                   price: 50   },
  egg_veechu_parotta:       { name: "Egg Veechu Parotta",               price: 70   },
  egg_kothu_parotta:        { name: "Egg Kothu Parotta",                price: 140  },
  chicken_kothu_parotta:    { name: "Chicken Kothu Parotta",            price: 180  },
  chilly_parotta:           { name: "Chilly Parotta",                   price: 130  },
  ceylon_chicken_parotta:   { name: "Ceylon Chicken Parotta",           price: 150  },
  naan:                     { name: "Naan",                             price: 60   },
  butter_naan:              { name: "Butter Naan",                      price: 70   },
  rotti:                    { name: "Rotti",                            price: 40   },
  butter_rotti:             { name: "Butter Rotti",                     price: 50   },
  pulka_2pcs:               { name: "Pulka 2pcs",                       price: 50   },
  kulcha:                   { name: "Kulcha",                           price: 60   },
  butter_kulcha:            { name: "Butter Kulcha",                    price: 70   },
  garlic_kulcha:            { name: "Garlic Kulcha",                    price: 80   },
  veg_noodles:              { name: "Veg Noodles",                      price: 120  },
  egg_noodles:              { name: "Egg Noodles",                      price: 140  },
  fish_noodles:             { name: "Fish Noodles",                     price: 180  },
  chicken_noodles:          { name: "Chicken Noodles",                  price: 160  },
  prawns_noodles:           { name: "Prawns Noodles",                   price: 200  },
  mixed_noodles:            { name: "Mixed Noodles",                    price: 220  },
  schezwan_egg_noodles:     { name: "Schezwan Egg Noodles",             price: 150  },
  schezwan_fish_noodles:    { name: "Schezwan Fish Noodles",            price: 200  },
  schezwan_chicken_noodles: { name: "Schezwan Chicken Noodles",         price: 180  },
  veg_fried_rice:           { name: "Veg Fried Rice",                   price: 120  },
  jeera_fried_rice:         { name: "Jeera Fried Rice",                 price: 150  },
  ghee_fried_rice:          { name: "Ghee Fried Rice",                  price: 150  },
  egg_fried_rice:           { name: "Egg Fried Rice",                   price: 140  },
  chicken_fried_rice:       { name: "Chicken Fried Rice",               price: 160  },
  prawns_fried_rice:        { name: "Prawns Fried Rice",                price: 200  },
  schezwan_egg_fried_rice:  { name: "Schezwan Egg Fried Rice",          price: 150  },
  schezwan_chicken_fried_rice: { name: "Schezwan Chicken Fried Rice",   price: 180  },
  schezwan_prawns_fried_rice:  { name: "Schezwan Prawns Fried Rice",    price: 220  },
  schezwan_mixed_fried_rice:   { name: "Schezwan Mixed Meat Fried Rice",price: 220  },
  kal_dosa:                 { name: "Kal Dosa",                         price: 50   },
  plain_dosa:               { name: "Plain Dosa",                       price: 50   },
  idiyappam_2pcs:           { name: "Idiyappam (2pcs)",                 price: 30   },
  plain_roast:              { name: "Plain Roast",                      price: 60   },
  ghee_roast:               { name: "Ghee Roast",                       price: 70   },
  uthappam:                 { name: "Uthappam",                         price: 50   },
  onion_uthappam:           { name: "Onion Uthappam",                   price: 70   },
  idly_2pcs:                { name: "Idly (2pcs)",                      price: 30   },
  chicken_curry_uthappam:   { name: "Chicken Curry Uthappam",           price: 120  },
  egg_dosai:                { name: "Egg Dosai",                        price: 70   },
  veg_meals:                { name: "Veg Meals",                        price: 120  },
  non_veg_meals:            { name: "Non Veg Meals",                    price: 140  },
  omelette:                 { name: "Omelette",                         price: 25   },
  egg_burji:                { name: "Egg Burji",                        price: 70   },
  egg_masala:               { name: "Egg Masala",                       price: 120  },
  half_boil:                { name: "Half Boil",                        price: 20   },
  full_boil:                { name: "Full Boil",                        price: 20   },
  boiled_egg_2pcs:          { name: "Boiled Egg 2pcs",                  price: 40   },
  double_omelette:          { name: "Double Omelette",                  price: 50   },
  masala_kalakki:           { name: "Masala Kalakki",                   price: 30   },
};

// ── Extract items from flow payload ──────────────────────
function extractItems(data) {
  const items = [];
  const skip = ["none", "", null, undefined, "category", "note",
                "customer_name", "customer_phone", "delivery_address",
                "order_type", "restaurant", "error_messages", "init_values"];

  for (const [key, value] of Object.entries(data)) {
    if (skip.includes(key)) continue;
    const val = String(value || "").toLowerCase().trim();
    if (skip.includes(val)) continue;
    const itemInfo = ITEM_PRICE_MAP[val];
    if (itemInfo) {
      items.push({ name: itemInfo.name, price: itemInfo.price, quantity: 1 });
    }
  }
  return items;
}

// ── Flow Endpoint ─────────────────────────────────────────
router.post("/endpoint", async (req, res) => {
  try {
    const body = req.body;

    // ── Health Check Ping (unencrypted) ───────────────────
    if (body?.action === "ping") {
      console.log("✅ Health check ping received (unencrypted)");
      return res.status(200).json({ data: { status: "active" } });
    }

    // ── Must have encrypted fields ────────────────────────
    if (!body?.encrypted_aes_key || !body?.encrypted_flow_data || !body?.initial_vector) {
      console.warn("⚠️ Missing encrypted fields:", Object.keys(body || {}));
      return res.status(200).json({ data: { status: "active" } });
    }

    // ── Decrypt ───────────────────────────────────────────
    let decryptedBody, aesKey, iv;
    try {
      ({ decryptedBody, aesKey, iv } = decryptRequest(body));
    } catch (decryptErr) {
      console.error("❌ Decrypt error:", decryptErr.message);
      return res.status(421).json({ error: "Decryption failed" });
    }

    const { flow_token, data, action, screen } = decryptedBody;
    console.log("📩 Flow:", JSON.stringify({ action, screen, flow_token }, null, 2));

    // ── Encrypted Ping ────────────────────────────────────
    if (action === "ping") {
      console.log("✅ Health check ping received (encrypted)");
      return res.status(200).send(
        encryptResponse({ data: { status: "active" } }, aesKey, iv)
      );
    }

    const phone = flow_token?.split("_")[1];

    // ── Item screens → go to DELIVERY_DETAILS ─────────────
    const itemScreens = [
      "CATEGORY_SELECT",
      "SOUP_ORDER", "STARTERS_ORDER", "BBQ_ORDER", "BIRYANI_ORDER",
      "DRY_GRAVY_ORDER", "SEAFOOD_ORDER", "BREADS_NOODLES_ORDER",
      "FRIED_RICE_TIFFIN_ORDER", "MEALS_EGGIES_ORDER"
    ];

    if (itemScreens.includes(screen)) {
      return res.status(200).send(
        encryptResponse(
          {
            screen: "DELIVERY_DETAILS",
            data: { ...data, error_messages: {}, init_values: {} },
          },
          aesKey, iv
        )
      );
    }

    // ── DELIVERY_DETAILS → ORDER_SUMMARY ──────────────────
    if (screen === "DELIVERY_DETAILS") {
      return res.status(200).send(
        encryptResponse(
          { screen: "ORDER_SUMMARY", data: { ...data } },
          aesKey, iv
        )
      );
    }

    // ── COMPLETE → Save Order ─────────────────────────────
    if (action === "complete") {
      const { customer_name, customer_phone, delivery_address, order_type } = data;

      const items = extractItems(data);
      const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const orderId = "KAV" + Date.now();

      const newOrder = new Order({
        orderId,
        phone:    customer_phone || phone,
        name:     customer_name  || "Customer",
        address:  `${delivery_address || ""} (${order_type || "delivery"})`,
        items,
        totalAmount,
        paymentMethod: "Cash on Delivery",
        status: "confirmed",
      });

      await newOrder.save();
      console.log(`✅ Order: ${orderId} | Items: ${items.length} | Total: Rs.${totalAmount}`);

      if (customer_phone || phone) {
        try {
          await sendOrderConfirmation(customer_phone || phone, {
            orderId, items, totalAmount, paymentMethod: "COD",
            orderType: order_type === "dine_in" ? "🍽️ Dine In" :
                       order_type === "takeaway" ? "🏃 Takeaway" : "🛵 Home Delivery",
            address: delivery_address || "",
          });
        } catch (msgErr) {
          console.error("❌ Confirmation error:", msgErr.message);
        }
      }

      return res.status(200).send(
        encryptResponse(
          { screen: "SUCCESS", data: { order_id: orderId, total: totalAmount } },
          aesKey, iv
        )
      );
    }

    // ── Default ───────────────────────────────────────────
    return res.status(200).send(
      encryptResponse({ screen: "CATEGORY_SELECT", data: {} }, aesKey, iv)
    );

  } catch (err) {
    console.error("❌ Flow error:", err.message);
    return res.status(200).json({ error: "Server Error" });
  }
});

module.exports = router;