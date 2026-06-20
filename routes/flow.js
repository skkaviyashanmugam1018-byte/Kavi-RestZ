
const express = require("express");
const router  = express.Router();
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const Session = require("../models/Session");
const { sendButtons, sendText } = require("../config/whatsapp");
const { getChargeFromPincode, getChargeFromLocation } = require("../config/distanceHelper");
 
let privateKey;
if (process.env.PRIVATE_KEY) {
  privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, "\n").replace(/\\r/g, "");
  console.log("🔑 PRIVATE_KEY from env, length:", privateKey.length);
} else {
  privateKey = fs.readFileSync(path.join(__dirname, "../private.pem"), "utf8");
  console.log("🔑 Using private.pem, length:", privateKey.length);
}
 
function decryptRequest(body) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;
  const decryptedAesKey = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(encrypted_aes_key, "base64")
  );
  const iv = Buffer.from(initial_vector, "base64");
  const encryptedData = Buffer.from(encrypted_flow_data, "base64");
  const TAG_LENGTH = 16;
  const encryptedBody = encryptedData.slice(0, -TAG_LENGTH);
  const authTag = encryptedData.slice(-TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-128-gcm", decryptedAesKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = decipher.update(encryptedBody, undefined, "utf8") + decipher.final("utf8");
  return { decryptedBody: JSON.parse(decrypted), aesKey: decryptedAesKey, iv };
}
 
function encryptResponse(response, aesKey, iv) {
  const flippedIv = Buffer.alloc(iv.length);
  for (let i = 0; i < iv.length; i++) flippedIv[i] = ~iv[i];
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(response), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return encrypted.toString("base64");
}
 
const GST_PERCENT = 5;
const ADDON_PRICES = {
  raita:       { name: "Raita",         price: 30 },
  pickle:      { name: "Pickle",        price: 20 },
  papad:       { name: "Papad",         price: 20 },
  extra_gravy: { name: "Extra Gravy",   price: 50 },
  salad:       { name: "Salad",         price: 40 },
  curd_rice:   { name: "Curd Rice",     price: 60 },
  sweet:       { name: "Sweet (Kheer)", price: 50 },
};
 
const SEATING_LABELS = {
  ac:          "❄️ AC Hall",
  non_ac:      "🌿 Non-AC",
  family_hall: "👨‍👩‍👧 Family Hall",
  outdoor:     "🌳 Outdoor",
};
 
const CELEBRATION_LABELS = {
  birthday:    "🎂 Birthday Decoration",
  anniversary: "💑 Anniversary Setup",
  cake:        "🎂 Cake Arrangement",
  flowers:     "💐 Flower Bouquet",
  candle:      "🕯️ Candle Light Dinner",
  board:       "🪧 Welcome Name Board",
  photo:       "📸 Photography",
};
 
router.post("/endpoint", async (req, res) => {
  try {
    const body = req.body;
    console.log("📩 Flow endpoint | action:", body?.action || "encrypted");
 
    // ✅ Unencrypted ping
    if (body?.action === "ping") {
      console.log("🏓 Ping → pong");
      return res.status(200).json({ version: "3.0", data: { status: "active" } });
    }
 
    if (!body?.encrypted_aes_key || !body?.encrypted_flow_data || !body?.initial_vector) {
      return res.status(200).json({ version: "3.0", data: { status: "active" } });
    }
 
    let decryptedBody, aesKey, iv;
    try {
      ({ decryptedBody, aesKey, iv } = decryptRequest(body));
    } catch (err) {
      console.error("❌ Decrypt error:", err.message);
      return res.status(421).json({ error: "Decryption failed" });
    }
 
    const { flow_token, data, action, screen } = decryptedBody;
    console.log("📩 Flow:", JSON.stringify({ action, screen }, null, 2));
 
    // ✅ Encrypted ping
    if (action === "ping") {
      return res.status(200).send(encryptResponse({ version: "3.0", data: { status: "active" } }, aesKey, iv));
    }
 
    // Extract phone from token: "delivery_<phone>_<timestamp>"
    const tokenParts = (flow_token || "").split("_");
    const phone = tokenParts.length >= 2 ? tokenParts[1] : null;
    console.log(`📞 Phone: ${phone}`);
 
    // ✅ INIT — jump directly to correct screen based on pre-selected order type
    if (action === "INIT" || (action === "navigate" && (!screen || screen === ""))) {
      console.log("📋 INIT");
      let cartSummary = "Table Booking", totalAmount = "Rs.0";
      let preSelectedType = "", waName = "", waPhone = "";
      let liveLocation = "";
 
      if (phone) {
        try {
          const sess = await Session.findOne({ phoneNumber: phone });
          if (sess) {
            if (sess.cart?.length > 0) {
              cartSummary = sess.cart.map(i => `${i.name} x${i.qty}`).join(", ");
              const total = sess.cart.reduce((s, i) => s + i.price * i.qty, 0);
              totalAmount = `Rs.${total}`;
            }
            preSelectedType = sess.preSelectedOrderType || "";
            waName   = sess.whatsappName || "";
            waPhone  = phone.replace(/^91/, "");
            liveLocation = sess.deliveryData?.live_location || "";
          }
        } catch (e) { console.error("Session fetch error:", e.message); }
      }
 
      console.log(`📋 INIT | preSelected: ${preSelectedType} | cart: ${cartSummary}`);
 
      // ✅ Jump directly to correct screen — skip ORDER_TYPE
      if (preSelectedType === "dine_in") {
        return res.status(200).send(encryptResponse({
          screen: "DINE_DETAILS",
          data: {
            order_type: "dine_in",
            cart_summary: cartSummary,
            total_amount: totalAmount,
          },
        }, aesKey, iv));
      }
 
      if (preSelectedType === "takeaway") {
        return res.status(200).send(encryptResponse({
          screen: "TAKEAWAY_DETAILS",
          data: {
            order_type: "takeaway",
            cart_summary: cartSummary,
            total_amount: totalAmount,
          },
        }, aesKey, iv));
      }
 
      if (preSelectedType === "delivery") {
        return res.status(200).send(encryptResponse({
          screen: "DELIVERY_DETAILS",
          data: {
            order_type: "delivery",
            cart_summary: cartSummary,
            total_amount: totalAmount,
            live_location_address: liveLocation,
            customer_name_prefill: waName,
            customer_phone_prefill: waPhone,
          },
        }, aesKey, iv));
      }
 
      // Fallback — show ORDER_TYPE if no pre-selection
      return res.status(200).send(encryptResponse({
        screen: "ORDER_TYPE",
        data: {
          cart_summary:   cartSummary,
          total_amount:   totalAmount,
          error_messages: {},
          init_values:    {
            ...(waName ? { customer_name: waName } : {}),
            customer_phone: waPhone,
          },
        },
      }, aesKey, iv));
    }
 
    // ── ORDER_TYPE → route to correct flow ───────────────
    if (screen === "ORDER_TYPE") {
      const orderType = data.order_type || "delivery";
      console.log(`📋 ORDER_TYPE → ${orderType}`);
 
      // Fetch live location if shared
      let liveLocationAddress = "";
      try {
        const sess = await Session.findOne({ phoneNumber: phone });
        liveLocationAddress = sess?.deliveryData?.live_location || "";
      } catch(e) {}
 
      const baseData = {
        order_type:    orderType,
        cart_summary:  data.cart_summary || "",
        total_amount:  data.total_amount || "",
      };
 
      if (orderType === "takeaway") {
        return res.status(200).send(encryptResponse({ screen: "TAKEAWAY_DETAILS", data: baseData }, aesKey, iv));
      }
      if (orderType === "dine_in") {
        return res.status(200).send(encryptResponse({ screen: "DINE_DETAILS", data: baseData }, aesKey, iv));
      }
      // delivery
      return res.status(200).send(encryptResponse({
        screen: "DELIVERY_DETAILS",
        data: { ...baseData, live_location_address: liveLocationAddress, customer_name_prefill: "", customer_phone_prefill: phone?.replace(/^91/,"") || "" },
      }, aesKey, iv));
    }
 
    // ── COMPLETE ──────────────────────────────────────────
    if (action === "complete") {
      console.log("✅ Flow COMPLETE!");
      console.log("📦 Data:", JSON.stringify(data, null, 2));
 
      const {
        order_type,
        customer_name, customer_phone, alternate_phone,
        delivery_address, pincode, live_location_address,
        selected_addons, special_instructions,
        table_persons, table_date, table_time, table_seating,
        celebration_addons, occasion_name,
        pickup_date, pickup_time,
      } = data;
 
      // ── Calculate delivery charge ─────────────────────
      let deliveryCharge = 0, distanceInfo = "";
      if (order_type === "delivery") {
        let sess = null;
        try { sess = await Session.findOne({ phoneNumber: phone }); } catch(e) {}
        const liveCoords = sess?.deliveryData?.live_location_coords;
 
        let distResult;
        if (liveCoords) {
          distResult = getChargeFromLocation(liveCoords.lat, liveCoords.lng);
          distanceInfo = `📍 Live Location (${distResult.km}km)`;
        } else if (pincode) {
          distResult = getChargeFromPincode(pincode);
          distanceInfo = `📮 ${distResult.area || pincode} (${distResult.km}km)`;
        } else {
          distResult = { km: 3, charge: 40 };
          distanceInfo = "📍 Address provided";
        }
        deliveryCharge = distResult.charge;
        console.log(`🚚 Delivery: ${distanceInfo} → Rs.${deliveryCharge}`);
      }
 
      // ── Build address ─────────────────────────────────
      const liveAddr = live_location_address || "";
      const full_address =
        order_type === "delivery"
          ? liveAddr
            ? `${delivery_address ? delivery_address + ", " : ""}📍 ${liveAddr}${pincode ? " - " + pincode : ""}`
            : [delivery_address, pincode ? `- ${pincode}` : null].filter(Boolean).join(" ")
          : order_type === "takeaway"
          ? `Take Away | Pickup: ${pickup_date || ""} ${pickup_time || "ASAP"}`
          : "Dine In";
 
      // ── Calculate totals ──────────────────────────────
      let session = await Session.findOne({ phoneNumber: phone });
      if (!session) {
        console.error("❌ Session not found:", phone);
        return res.status(200).send(encryptResponse({ screen: "SUCCESS", data: { status: "error" } }, aesKey, iv));
      }
 
      const cartTotal  = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
      const addonList  = Array.isArray(selected_addons) ? selected_addons : [];
      const addonItems = addonList.map(id => ADDON_PRICES[id]).filter(Boolean);
      const addonTotal = addonItems.reduce((s, a) => s + a.price, 0);
      const subtotal   = cartTotal + addonTotal + deliveryCharge;
      const gstAmount  = Math.round(subtotal * GST_PERCENT / 100);
      const grandTotal = subtotal + gstAmount;
 
      const orderTypeLabel =
        order_type === "delivery" ? "🚚 Home Delivery" :
        order_type === "takeaway" ? "🥡 Take Away"     : "🍽️ Dine In";
 
      const addonText = addonItems.map(a => `${a.name} (Rs.${a.price})`).join(", ");
 
      const celebList = (Array.isArray(celebration_addons) ? celebration_addons : [])
        .map(id => CELEBRATION_LABELS[id] || id).join(", ");
 
      const seatingLabel = SEATING_LABELS[table_seating] || table_seating || "";
 
      const tableInfo =
        order_type === "dine_in"
          ? `\n👥 *Guests:* ${table_persons}\n📅 *Date:* ${table_date}\n🕐 *Slot:* ${table_time}\n🪑 *Seating:* ${seatingLabel}` +
            (occasion_name ? `\n🎉 *Occasion:* ${occasion_name}` : "") +
            (celebList ? `\n🎊 *Arrangements:* ${celebList}` : "")
          : order_type === "takeaway"
          ? `\n📅 *Date:* ${pickup_date || ""}\n🕐 *Pickup:* ${pickup_time || "ASAP"}`
          : "";
 
      const deliveryLabel = order_type === "delivery"
        ? `Rs.${deliveryCharge} (${distanceInfo})`
        : "Free";
 
      const itemsList = session.cart.map(i => `• ${i.name} × ${i.qty} = Rs.${i.price * i.qty}`).join("\n");
 
      // ── Save to session ───────────────────────────────
      session.deliveryData = {
        name:                 customer_name     || "Customer",
        phone:                customer_phone    || phone,
        alternate_phone:      alternate_phone   || "",
        address:              full_address,
        order_type,
        delivery_time:        "asap",
        table_persons:        table_persons     || "",
        table_date:           table_date        || "",
        table_time:           table_time        || "",
        table_seating:        table_seating     || "",
        seating_label:        seatingLabel,
        pickup_date:          pickup_date       || "",
        pickup_time:          pickup_time       || "",
        addons:               addonItems,
        addon_total:          addonTotal,
        delivery_charge:      deliveryCharge,
        distance_info:        distanceInfo,
        gst_amount:           gstAmount,
        special_instructions: special_instructions || "",
        celebration_addons:   Array.isArray(celebration_addons) ? celebration_addons : [],
        occasion_name:        occasion_name     || "",
        grand_total:          grandTotal,
        live_location:        session.deliveryData?.live_location || "",
      };
      session.state = "PAYMENT_SELECT";
      session.markModified("deliveryData");
      await session.save();
      console.log(`✅ Session saved | Grand Total: Rs.${grandTotal}`);
 
      // ── Bill text ─────────────────────────────────────
      const isDineIn = order_type === "dine_in";
      const billText =
        (isDineIn ? `✅ *Table Booking Confirmed!*\n\n` : `🧾 *Order Bill Summary*\n\n`) +
        `👤 *Name:* ${customer_name}\n` +
        `📞 *Phone:* ${customer_phone}\n` +
        (alternate_phone ? `📞 *Alt:* ${alternate_phone}\n` : "") +
        `📍 *Address:* ${full_address}\n` +
        `🚚 *Type:* ${orderTypeLabel}${tableInfo}\n` +
        (addonText ? `🍱 *Add-ons:* ${addonText}\n` : "") +
        (special_instructions ? `📝 *Note:* ${special_instructions}\n` : "") +
        `─────────────────\n` +
        (cartTotal > 0 ? `🛒 *Items:*\n${itemsList}\n─────────────────\n` : "") +
        (cartTotal > 0 ? `🛒 *Food Total:* Rs.${cartTotal}\n` : "") +
        (addonTotal > 0 ? `🍱 *Add-ons:* Rs.${addonTotal}\n` : "") +
        (order_type === "delivery" ? `🚚 *Delivery:* ${deliveryLabel}\n` : "") +
        `📊 *GST (5%):* Rs.${gstAmount}\n` +
        `─────────────────\n` +
        `💰 *Grand Total: Rs.${grandTotal}*\n\n` +
        `Select payment method:`;
 
      // ── Payment buttons ───────────────────────────────
      const payButtons =
        order_type === "dine_in" ? [
          { id: "PAY_REST", title: "🍽️ Pay at Restaurant" },
          { id: "PAY_UPI",  title: "📲 UPI Payment"       },
          { id: "PAY_CARD", title: "💳 Card Payment"       },
        ] : order_type === "takeaway" ? [
          { id: "PAY_COD",  title: "💵 Cash on Pickup"    },
          { id: "PAY_UPI",  title: "📲 UPI Payment"       },
          { id: "PAY_CARD", title: "💳 Card Payment"       },
        ] : [
          { id: "PAY_COD",  title: "💵 Cash on Delivery"  },
          { id: "PAY_UPI",  title: "📲 UPI Payment"       },
          { id: "PAY_CARD", title: "💳 Card Payment"       },
        ];
 
      await sendButtons(phone, billText, payButtons);
      return res.status(200).send(
        encryptResponse({ screen: "SUCCESS", data: { status: "payment_pending" } }, aesKey, iv)
      );
    }
 
    console.log("⚠️ Unhandled:", { action, screen });
    return res.status(200).send(encryptResponse({ version: "3.0", data: { status: "active" } }, aesKey, iv));
 
  } catch (err) {
    console.error("❌ Flow error:", err.message, err.stack);
    return res.status(200).json({ version: "3.0", error: "Server Error" });
  }
});
 
module.exports = router;
 
