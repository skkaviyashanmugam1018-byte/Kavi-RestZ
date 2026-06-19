const express = require("express");
const router  = express.Router();
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const Session = require("../models/Session");
const { sendButtons } = require("../config/whatsapp");
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

    // ✅ INIT — fetch cart from session
    if (action === "INIT" || (action === "navigate" && (!screen || screen === ""))) {
      console.log("📋 INIT → ORDER_TYPE");
      let cartSummary = "", totalAmount = "Rs.0";
      if (phone) {
        try {
          const session = await Session.findOne({ phoneNumber: phone });
          if (session?.cart?.length > 0) {
            cartSummary = session.cart.map(i => `${i.name} x${i.qty}`).join(", ");
            const total = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
            totalAmount = `Rs.${total}`;
          }
        } catch (e) { console.error("Session fetch error:", e.message); }
      }
      // Pre-fill name from WhatsApp profile if available
      let initValues = {};
      let whatsappName = "";
      if (phone) {
        try {
          const sess = await Session.findOne({ phoneNumber: phone });
          if (sess?.whatsappName) {
            whatsappName = sess.whatsappName;
            initValues = { customer_name: whatsappName, customer_phone: phone.replace(/^91/, "") };
          }
        } catch (e) {}
      }
      return res.status(200).send(encryptResponse({
        screen: "ORDER_TYPE",
        data: {
          cart_summary: cartSummary,
          total_amount: totalAmount,
          error_messages: {},
          init_values: initValues,
        },
      }, aesKey, iv));
    }

    // ── ORDER_TYPE → route ────────────────────────────────
    if (screen === "ORDER_TYPE") {
      const orderType = data.order_type || "delivery";
      console.log(`📋 ORDER_TYPE → ${orderType}`);
      const commonData = {
        customer_name:   data.customer_name   || "",
        customer_phone:  data.customer_phone  || "",
        alternate_phone: data.alternate_phone || "",
        order_type:      orderType,
        cart_summary:    data.cart_summary    || "",
        total_amount:    data.total_amount    || "",
      };

      if (orderType === "takeaway") {
        return res.status(200).send(encryptResponse({ screen: "TAKEAWAY_DETAILS", data: commonData }, aesKey, iv));
      }
      if (orderType === "dine_in") {
        return res.status(200).send(encryptResponse({ screen: "DINE_BOOKING", data: commonData }, aesKey, iv));
      }

      // delivery → check if user shared live location before flow
      let liveLocationAddress = "";
      if (phone) {
        try {
          const sess = await Session.findOne({ phoneNumber: phone });
          liveLocationAddress = sess?.deliveryData?.live_location || "";
        } catch (e) {}
      }
      return res.status(200).send(encryptResponse({
        screen: "DELIVERY_ADDRESS",
        data: { ...commonData, live_location_address: liveLocationAddress },
      }, aesKey, iv));
    }

    // ── COMPLETE ──────────────────────────────────────────
    if (action === "complete") {
      console.log("✅ Flow COMPLETE! Data:", JSON.stringify(data, null, 2));

      const {
        customer_name, customer_phone, alternate_phone,
        order_type, delivery_address, pincode, live_location_address,
        selected_addons, special_instructions,
        table_persons, table_date, table_time, table_seating,
        pickup_time,
        celebration_addons, occasion_name,
      } = data;

      // ✅ Distance-based delivery charge
      let deliveryCharge = 0;
      let distanceInfo = "";
      if (order_type === "delivery") {
        let distResult;
        // Check session for live location coords
        let session = await Session.findOne({ phoneNumber: phone });
        const liveCoords = session?.deliveryData?.live_location_coords;

        if (liveCoords) {
          distResult = getChargeFromLocation(liveCoords.lat, liveCoords.lng);
          distanceInfo = `📍 Live Location (${distResult.km}km)`;
        } else if (pincode) {
          distResult = getChargeFromPincode(pincode);
          distanceInfo = `📮 ${distResult.area || pincode} (${distResult.km}km)`;
        } else {
          distResult = { km: 5, charge: 150 };
          distanceInfo = "📍 Distance unknown";
        }
        deliveryCharge = distResult.charge;
        console.log(`🚚 Delivery: ${distanceInfo} → Rs.${deliveryCharge}`);
      }

      const full_address =
        order_type === "delivery"
          ? live_location_address
            ? `${delivery_address ? delivery_address + ", " : ""}📍 ${live_location_address}${pincode ? " - " + pincode : ""}`
            : [delivery_address, pincode ? `- ${pincode}` : null].filter(Boolean).join(" ")
          : order_type === "takeaway"
          ? `Take Away | Pickup: ${pickup_time || "ASAP"}`
          : "Dine In";

      const addonList  = Array.isArray(selected_addons) ? selected_addons : [];
      const addonItems = addonList.map(id => ADDON_PRICES[id]).filter(Boolean);
      const addonTotal = addonItems.reduce((s, a) => s + a.price, 0);

      let session = await Session.findOne({ phoneNumber: phone });
      if (!session) {
        console.error("❌ Session not found:", phone);
        return res.status(200).send(encryptResponse({ screen: "SUCCESS", data: { status: "error" } }, aesKey, iv));
      }

      const cartTotal  = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
      const subtotal   = cartTotal + addonTotal + deliveryCharge;
      const gstAmount  = Math.round(subtotal * GST_PERCENT / 100);
      const grandTotal = subtotal + gstAmount;

      const orderTypeLabel =
        order_type === "delivery" ? "🚚 Home Delivery" :
        order_type === "takeaway" ? "🥡 Take Away"     : "🍽️ Dine In";

      const deliveryLabel = order_type === "delivery"
        ? `Rs.${deliveryCharge} (${distanceInfo})`
        : "Free";

      const addonText = addonItems.map(a => `${a.name} (Rs.${a.price})`).join(", ");
      const itemsList = session.cart.map(i => `• ${i.name} × ${i.qty} = Rs.${i.price * i.qty}`).join("\n");

      const tableInfo =
        order_type === "dine_in"
          ? `\n👥 *Guests:* ${table_persons}\n📅 *Date:* ${table_date}\n🕐 *Slot:* ${table_time}\n🪑 *Seating:* ${table_seating === "ac" ? "❄️ AC" : "🌿 Non-AC"}`
          : order_type === "takeaway"
          ? `\n🕐 *Pickup:* ${pickup_time || "ASAP"}`
          : "";

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
        pickup_time:          pickup_time       || "",
        addons:               addonItems,
        addon_total:          addonTotal,
        delivery_charge:      deliveryCharge,
        distance_info:        distanceInfo,
        gst_amount:           gstAmount,
        special_instructions: special_instructions || "",
        grand_total:          grandTotal,
        live_location:        session.deliveryData?.live_location || "",
      };
      session.state = "PAYMENT_SELECT";
      session.markModified("deliveryData");
      await session.save();
      console.log(`✅ Session saved | Grand Total: Rs.${grandTotal}`);

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
        `🛒 *Items:*\n${itemsList}\n` +
        `─────────────────\n` +
        `🛒 *Subtotal:* Rs.${cartTotal}\n` +
        (addonTotal > 0 ? `🍱 *Add-ons:* Rs.${addonTotal}\n` : "") +
        `🚚 *Delivery:* ${deliveryLabel}\n` +
        `📊 *GST (${GST_PERCENT}%):* Rs.${gstAmount}\n` +
        `─────────────────\n` +
        `💰 *Grand Total: Rs.${grandTotal}*\n\n` +
        `Select payment method:`;

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
      return res.status(200).send(encryptResponse({ screen: "SUCCESS", data: { status: "payment_pending" } }, aesKey, iv));
    }

    console.log("⚠️ Unhandled:", { action, screen });
    return res.status(200).send(encryptResponse({ version: "3.0", data: { status: "active" } }, aesKey, iv));

  } catch (err) {
    console.error("❌ Flow error:", err.message, err.stack);
    return res.status(200).json({ version: "3.0", error: "Server Error" });
  }
});

module.exports = router;
