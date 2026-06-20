const express = require("express");
const router  = express.Router();
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const Session = require("../models/Session");
const { sendButtons } = require("../config/whatsapp");
const { getChargeFromPincode, getChargeFromLocation } = require("../config/distanceHelper");

// ── Private Key ───────────────────────────────────────────
let privateKey;
if (process.env.PRIVATE_KEY) {
  privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, "\n").replace(/\\r/g, "");
  console.log("🔑 Using PRIVATE_KEY env, length:", privateKey.length);
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
  const decipher = crypto.createDecipheriv("aes-128-gcm", decryptedAesKey, iv);
  decipher.setAuthTag(encryptedData.slice(-TAG_LENGTH));
  const decrypted = decipher.update(encryptedData.slice(0, -TAG_LENGTH), undefined, "utf8") + decipher.final("utf8");
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

// ── Constants ─────────────────────────────────────────────
const GST = 5;
const ADDON_PRICES = {
  raita:       { name: "Raita",         price: 30 },
  pickle:      { name: "Pickle",        price: 20 },
  papad:       { name: "Papad",         price: 20 },
  extra_gravy: { name: "Extra Gravy",   price: 50 },
  salad:       { name: "Salad",         price: 40 },
  curd_rice:   { name: "Curd Rice",     price: 60 },
  sweet:       { name: "Sweet (Kheer)", price: 50 },
};
const SEATING_MAP = {
  ac:          "❄️ AC Hall",
  non_ac:      "🌿 Non-AC",
  vip:         "👑 VIP Section",
  indoor:      "🏠 Indoor",
  outdoor:     "🌳 Outdoor",
};
const CELEBRATION_MAP = {
  birthday:    "🎂 Birthday Decoration",
  anniversary: "💑 Anniversary Setup",
  cake:        "🎂 Cake Arrangement",
  flowers:     "💐 Flower Bouquet",
  candle:      "🕯️ Candle Light Dinner",
  board:       "🪧 Welcome Name Board",
  photo:       "📸 Photography",
};

// ── Helper: get session data ──────────────────────────────
async function getSessionData(phone) {
  try {
    return await Session.findOne({ phoneNumber: phone });
  } catch(e) {
    console.error("Session error:", e.message);
    return null;
  }
}

// ── Main Route ────────────────────────────────────────────
router.post("/endpoint", async (req, res) => {
  try {
    const body = req.body;
    console.log("📩 Flow endpoint | action:", body?.action || "encrypted");

    // Unencrypted ping
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
    } catch(err) {
      console.error("❌ Decrypt error:", err.message);
      return res.status(421).json({ error: "Decryption failed" });
    }

    const { flow_token, data, action, screen } = decryptedBody;
    console.log("📩 Flow:", JSON.stringify({ action, screen }, null, 2));

    // Encrypted ping
    if (action === "ping") {
      return res.status(200).send(encryptResponse({ version: "3.0", data: { status: "active" } }, aesKey, iv));
    }

    // Extract phone from token: "delivery_<phone>_<timestamp>"
    const phone = (flow_token || "").split("_")[1] || null;
    console.log(`📞 Phone: ${phone}`);

    // ══════════════════════════════════════════════════════
    // INIT — Jump directly to correct screen
    // ══════════════════════════════════════════════════════
    if (action === "INIT" || (action === "navigate" && (!screen || screen === ""))) {
      console.log("📋 INIT");

      const sess = await getSessionData(phone);
      let cartSummary = "Table Booking", totalAmount = "Rs.0";
      let preSelectedType = "", waName = "", waPhone = "";

      if (sess) {
        if (sess.cart?.length > 0) {
          cartSummary = sess.cart.map(i => `${i.name} x${i.qty}`).join(", ");
          totalAmount = `Rs.${sess.cart.reduce((s, i) => s + i.price * i.qty, 0)}`;
        }
        preSelectedType = sess.preSelectedOrderType || "";
        waName  = sess.whatsappName || "";
        waPhone = phone?.replace(/^91/, "") || "";
      }

      console.log(`📋 preSelected: ${preSelectedType} | cart: ${cartSummary}`);

      const initValues = {
        ...(waName  ? { customer_name:  waName  } : {}),
        ...(waPhone ? { customer_phone: waPhone } : {}),
      };

      // ✅ Jump directly — no ORDER_TYPE shown to user
      if (preSelectedType === "takeaway") {
        return res.status(200).send(encryptResponse({
          screen: "TAKEAWAY_DETAILS",
          data: { order_type: "takeaway", cart_summary: cartSummary, total_amount: totalAmount, init_values: initValues, error_messages: {} }
        }, aesKey, iv));
      }
      if (preSelectedType === "delivery") {
        return res.status(200).send(encryptResponse({
          screen: "DELIVERY_DETAILS",
          data: { order_type: "delivery", cart_summary: cartSummary, total_amount: totalAmount, init_values: initValues, error_messages: {} }
        }, aesKey, iv));
      }
      // Default: dine_in
      return res.status(200).send(encryptResponse({
        screen: "DINE_DETAILS",
        data: { order_type: "dine_in", cart_summary: cartSummary, total_amount: totalAmount, init_values: initValues, error_messages: {} }
      }, aesKey, iv));
    }

    // ══════════════════════════════════════════════════════
    // ORDER_TYPE data_exchange fallback (if old flow JSON)
    // ══════════════════════════════════════════════════════
    if (screen === "ORDER_TYPE" && action === "data_exchange") {
      const orderType = data.order_type || "dine_in";
      console.log(`📋 ORDER_TYPE fallback → ${orderType}`);

      const sess = await getSessionData(phone);
      let cartSummary = "Table Booking", totalAmount = "Rs.0";
      if (sess?.cart?.length > 0) {
        cartSummary = sess.cart.map(i => `${i.name} x${i.qty}`).join(", ");
        totalAmount = `Rs.${sess.cart.reduce((s, i) => s + i.price * i.qty, 0)}`;
      }
      const initValues = {
        customer_name:  sess?.whatsappName || "",
        customer_phone: phone?.replace(/^91/, "") || "",
      };

      if (orderType === "takeaway") {
        return res.status(200).send(encryptResponse({
          screen: "TAKEAWAY_DETAILS",
          data: { order_type: "takeaway", cart_summary: cartSummary, total_amount: totalAmount, init_values: initValues, error_messages: {} }
        }, aesKey, iv));
      }
      if (orderType === "delivery") {
        return res.status(200).send(encryptResponse({
          screen: "DELIVERY_DETAILS",
          data: { order_type: "delivery", cart_summary: cartSummary, total_amount: totalAmount, init_values: initValues, error_messages: {} }
        }, aesKey, iv));
      }
      return res.status(200).send(encryptResponse({
        screen: "DINE_DETAILS",
        data: { order_type: "dine_in", cart_summary: cartSummary, total_amount: totalAmount, init_values: initValues, error_messages: {} }
      }, aesKey, iv));
    }

    // ══════════════════════════════════════════════════════
    // COMPLETE — Process order and send bill
    // ══════════════════════════════════════════════════════
    if (action === "complete") {
      console.log("✅ Flow COMPLETE!");
      console.log("📦 Data:", JSON.stringify(data, null, 2));

      const {
        order_type,
        customer_name, customer_phone, alternate_phone,
        delivery_address, pincode,
        selected_addons, special_instructions,
        table_persons, table_date, table_time, table_seating,
        celebration_addons, occasion_name,
        pickup_date, pickup_time,
      } = data;

      // ── Delivery charge ──────────────────────────────────
      let deliveryCharge = 0, distanceInfo = "";
      if (order_type === "delivery") {
        const sess = await getSessionData(phone);
        const liveCoords = sess?.deliveryData?.live_location_coords;
        let dr;
        if (liveCoords) {
          dr = getChargeFromLocation(liveCoords.lat, liveCoords.lng);
          distanceInfo = `📍 Live Location (${dr.km}km)`;
        } else if (pincode) {
          dr = getChargeFromPincode(pincode);
          distanceInfo = `📮 ${dr.area || pincode} (${dr.km}km)`;
        } else {
          dr = { km: 3, charge: 40 };
          distanceInfo = "📍 Address provided";
        }
        deliveryCharge = dr.charge;
        console.log(`🚚 Delivery: ${distanceInfo} → Rs.${deliveryCharge}`);
      }

      // ── Address ──────────────────────────────────────────
      const full_address =
        order_type === "delivery"
          ? [delivery_address, pincode ? `- ${pincode}` : null].filter(Boolean).join(" ")
          : order_type === "takeaway"
          ? `Take Away | ${pickup_date || ""} ${pickup_time || "ASAP"}`
          : "Dine In";

      // ── Cart & totals ────────────────────────────────────
      const session = await getSessionData(phone);
      if (!session) {
        console.error("❌ Session not found:", phone);
        return res.status(200).send(encryptResponse({ screen: "SUCCESS", data: { status: "error" } }, aesKey, iv));
      }

      const cartTotal  = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
      const addonList  = Array.isArray(selected_addons) ? selected_addons : [];
      const addonItems = addonList.map(id => ADDON_PRICES[id]).filter(Boolean);
      const addonTotal = addonItems.reduce((s, a) => s + a.price, 0);
      const subtotal   = cartTotal + addonTotal + deliveryCharge;
      const gstAmount  = Math.round(subtotal * GST / 100);
      const grandTotal = subtotal + gstAmount;

      const seatLabel  = SEATING_MAP[table_seating]  || table_seating || "";
      const celebText  = (Array.isArray(celebration_addons) ? celebration_addons : [])
        .map(id => CELEBRATION_MAP[id] || id).filter(Boolean).join(", ");
      const addonText  = addonItems.map(a => `${a.name} (Rs.${a.price})`).join(", ");
      const itemsList  = session.cart.map(i => `• ${i.name} × ${i.qty} = Rs.${i.price * i.qty}`).join("\n");

      const orderTypeLabel =
        order_type === "delivery" ? "🚚 Home Delivery" :
        order_type === "takeaway" ? "🥡 Take Away"     : "🍽️ Dine In";

      const delivLabel = order_type === "delivery"
        ? `Rs.${deliveryCharge} (${distanceInfo})` : "Free";

      const tableInfo =
        order_type === "dine_in" && table_persons
          ? `\n👥 *Guests:* ${table_persons}\n📅 *Date:* ${table_date}\n🕐 *Slot:* ${table_time}\n🪑 *Seating:* ${seatLabel}` +
            (occasion_name ? `\n🎉 *Occasion:* ${occasion_name}` : "") +
            (celebText    ? `\n🎊 *Arrangements:* ${celebText}`  : "")
          : order_type === "takeaway"
          ? `\n📅 *Date:* ${pickup_date || ""}\n🕐 *Pickup:* ${pickup_time || "ASAP"}`
          : "";

      // ── Save to session ──────────────────────────────────
      session.deliveryData = {
        name:                 customer_name     || "Customer",
        phone:                customer_phone    || phone,
        alternate_phone:      alternate_phone   || "",
        address:              full_address,
        order_type,
        table_persons:        table_persons     || "",
        table_date:           table_date        || "",
        table_time:           table_time        || "",
        table_seating:        table_seating     || "",
        seating_label:        seatLabel,
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
      console.log(`✅ Session saved | Grand Total: Rs.${grandTotal} | State: PAYMENT_SELECT`);

      // ── Bill text ────────────────────────────────────────
      const isDineIn = order_type === "dine_in";
      const billText =
        (isDineIn ? `✅ *Table Booking Details*\n\n` : `🧾 *Order Summary*\n\n`) +
        `👤 *Name:* ${customer_name}\n` +
        `📞 *Phone:* ${customer_phone}\n` +
        (alternate_phone ? `📞 *Alt:* ${alternate_phone}\n` : "") +
        (!isDineIn ? `📍 *Address:* ${full_address}\n` : "") +
        `🚚 *Type:* ${orderTypeLabel}${tableInfo}\n` +
        (addonText ? `🍱 *Add-ons:* ${addonText}\n` : "") +
        (special_instructions ? `📝 *Note:* ${special_instructions}\n` : "") +
        `─────────────────\n` +
        (cartTotal > 0 ? `🛒 *Items:*\n${itemsList}\n─────────────────\n` : "") +
        (cartTotal > 0 ? `💰 *Food Total:* Rs.${cartTotal}\n` : "") +
        (addonTotal > 0 ? `🍱 *Add-ons:* Rs.${addonTotal}\n` : "") +
        (order_type === "delivery" ? `🚚 *Delivery:* ${delivLabel}\n` : "") +
        `📊 *GST (${GST}%):* Rs.${gstAmount}\n` +
        `─────────────────\n` +
        `💰 *Grand Total: Rs.${grandTotal}*\n\n` +
        `Choose payment method:`;

      // ── Payment buttons ──────────────────────────────────
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

    // ── Unknown ───────────────────────────────────────────
    console.log("⚠️ Unhandled:", { action, screen });
    return res.status(200).send(encryptResponse({ version: "3.0", data: { status: "active" } }, aesKey, iv));

  } catch(err) {
    console.error("❌ Flow error:", err.message);
    console.error(err.stack);
    return res.status(200).json({ version: "3.0", error: "Server Error" });
  }
});

module.exports = router;
