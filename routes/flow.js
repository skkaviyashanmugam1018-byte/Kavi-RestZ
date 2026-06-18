const express = require("express");
const router  = express.Router();
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const Session = require("../models/Session");
const { sendButtons, sendText, sendImage } = require("../config/whatsapp");

let privateKey;
if (process.env.PRIVATE_KEY) {
  privateKey = process.env.PRIVATE_KEY
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "");
  console.log("🔑 Using PRIVATE_KEY from env, length:", privateKey.length);
} else {
  privateKey = fs.readFileSync(path.join(__dirname, "../private.pem"), "utf8");
  console.log("🔑 Using private.pem file, length:", privateKey.length);
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

    if (body?.action === "ping") {
      return res.status(200).json({ data: { status: "active" } });
    }

    if (!body?.encrypted_aes_key || !body?.encrypted_flow_data || !body?.initial_vector) {
      return res.status(200).json({ data: { status: "active" } });
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

    if (action === "ping") {
      return res.status(200).send(encryptResponse({ data: { status: "active" } }, aesKey, iv));
    }

    // ── INITIAL LOAD ──────────────────────────────────────
    if (action === "navigate" && (!screen || screen === "")) {
      console.log("📋 Initial load → ORDER_TYPE");
      return res.status(200).send(encryptResponse({
        screen: "ORDER_TYPE",
        data: {
          cart_summary:   data?.cart_summary   || "",
          total_amount:   data?.total_amount   || "Rs.0",
          error_messages: {},
          init_values:    {},
        }
      }, aesKey, iv));
    }

    const tokenParts = (flow_token || "").split("_");
    const phone = tokenParts.length >= 2 ? tokenParts[1] : null;
    console.log(`📞 Phone: ${phone}`);

    // ── ORDER_TYPE → route based on order_type ────────────
    if (screen === "ORDER_TYPE") {
      const orderType = data.order_type || "delivery";
      console.log(`📋 ORDER_TYPE → ${orderType}`);
      const commonData = {
        customer_name:  data.customer_name  || "",
        customer_phone: data.customer_phone || "",
        alternate_phone: data.alternate_phone || "",
        order_type:     orderType,
        cart_summary:   data.cart_summary   || "",
        total_amount:   data.total_amount   || "",
      };
      if (orderType === "takeaway") {
        return res.status(200).send(encryptResponse({ screen: "TAKEAWAY_ADDONS", data: commonData }, aesKey, iv));
      }
      if (orderType === "dine_in") {
        return res.status(200).send(encryptResponse({ screen: "DINE_BOOKING", data: commonData }, aesKey, iv));
      }
      return res.status(200).send(encryptResponse({ screen: "DELIVERY_ADDRESS", data: commonData }, aesKey, iv));
    }

    // ── DELIVERY_ADDRESS → DELIVERY_KMS ──────────────────
    if (screen === "DELIVERY_ADDRESS") {
      console.log("📋 DELIVERY_ADDRESS → DELIVERY_KMS");
      return res.status(200).send(encryptResponse({
        screen: "DELIVERY_KMS",
        data: { ...data }
      }, aesKey, iv));
    }

    // ── DELIVERY_KMS → DELIVERY_ADDONS ───────────────────
    if (screen === "DELIVERY_KMS") {
      console.log("📋 DELIVERY_KMS → DELIVERY_ADDONS");
      return res.status(200).send(encryptResponse({
        screen: "DELIVERY_ADDONS",
        data: { ...data }
      }, aesKey, iv));
    }

    // ── DELIVERY_ADDONS → DELIVERY_SUMMARY ───────────────
    if (screen === "DELIVERY_ADDONS") {
      console.log("📋 DELIVERY_ADDONS → DELIVERY_SUMMARY");
      return res.status(200).send(encryptResponse({
        screen: "DELIVERY_SUMMARY",
        data: { ...data, selected_addons: data.selected_addons || [], special_instructions: data.special_instructions || "" }
      }, aesKey, iv));
    }

    // ── TAKEAWAY_ADDONS → TAKEAWAY_SUMMARY ───────────────
    if (screen === "TAKEAWAY_ADDONS") {
      console.log("📋 TAKEAWAY_ADDONS → TAKEAWAY_SUMMARY");
      return res.status(200).send(encryptResponse({
        screen: "TAKEAWAY_SUMMARY",
        data: { ...data, selected_addons: data.selected_addons || [], special_instructions: data.special_instructions || "", pickup_time: data.pickup_time || "" }
      }, aesKey, iv));
    }

    // ── COMPLETE ──────────────────────────────────────────
    if (action === "complete") {
      console.log("✅ Flow COMPLETE!");
      console.log("📦 Data:", JSON.stringify(data, null, 2));

      const {
        customer_name, customer_phone, alternate_phone,
        order_type, delivery_address, pincode, within_five_km,
        selected_addons, special_instructions,
        table_persons, table_date, table_time, table_seating,
        pickup_time,
      } = data;

      const full_address = order_type === "delivery"
        ? [delivery_address, pincode ? `- ${pincode}` : null].filter(Boolean).join(" ")
        : order_type === "takeaway" ? `Take Away | Pickup: ${pickup_time || "ASAP"}` : "Dine In";

      const addonList  = Array.isArray(selected_addons) ? selected_addons : [];
      const addonItems = addonList.map(id => ADDON_PRICES[id]).filter(Boolean);
      const addonTotal = addonItems.reduce((s, a) => s + a.price, 0);
      const isDelivery = order_type === "delivery";
      const deliveryCh = isDelivery ? (within_five_km === "yes" ? 100 : 150) : 0;

      let session = await Session.findOne({ phoneNumber: phone });
      if (!session) {
        console.error("❌ Session not found:", phone);
        return res.status(200).send(encryptResponse({ screen: "SUCCESS", data: { status: "error" } }, aesKey, iv));
      }

      const cartTotal  = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
      const subtotal   = cartTotal + addonTotal + deliveryCh;
      const gstAmount  = Math.round(subtotal * GST_PERCENT / 100);
      const grandTotal = subtotal + gstAmount;

      const orderTypeLabel =
        order_type === "delivery" ? "🚚 Home Delivery" :
        order_type === "takeaway" ? "🥡 Take Away"     : "🍽️ Dine In";

      const deliveryLabel = isDelivery
        ? `Rs.${deliveryCh} (${within_five_km === "yes" ? "Within 5km" : "Above 5km"})`
        : "Free";

      const addonText = addonItems.length > 0
        ? addonItems.map(a => `${a.name} (Rs.${a.price})`).join(", ")
        : "";

      const tableInfo = order_type === "dine_in"
        ? `\n👥 *People:* ${table_persons}\n📅 *Date:* ${table_date}\n🕐 *Time:* ${table_time}\n🪑 *Seating:* ${table_seating === "ac" ? "❄️ AC" : "🌿 Non-AC"}`
        : order_type === "takeaway" ? `\n🕐 *Pickup Time:* ${pickup_time}` : "";

      session.deliveryData = {
        name: customer_name || "Customer",
        phone: customer_phone || phone,
        alternate_phone: alternate_phone || "",
        address: full_address,
        order_type,
        delivery_time: "asap",
        table_persons: table_persons || "",
        table_date: table_date || "",
        table_time: table_time || "",
        table_seating: table_seating || "",
        pickup_time: pickup_time || "",
        addons: addonItems,
        addon_total: addonTotal,
        delivery_charge: deliveryCh,
        gst_amount: gstAmount,
        special_instructions: special_instructions || "",
        grand_total: grandTotal,
      };
      session.state = "PAYMENT_SELECT";
      session.markModified("deliveryData");
      await session.save();
      console.log(`✅ Session saved | Total: Rs.${grandTotal}`);

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
        `🛒 *Items:* Rs.${cartTotal}\n` +
        (addonTotal > 0 ? `🍱 *Add-ons:* Rs.${addonTotal}\n` : "") +
        `🚚 *Delivery:* ${deliveryLabel}\n` +
        `📊 *GST (${GST_PERCENT}%):* Rs.${gstAmount}\n` +
        `─────────────────\n` +
        `💰 *Grand Total: Rs.${grandTotal}*\n\n` +
        `Select payment method:`;

      if (order_type === "delivery") {
        await sendButtons(phone, billText, [
          { id: "PAY_COD",  title: "💵 Cash on Delivery" },
          { id: "PAY_UPI",  title: "📲 UPI Payment"      },
          { id: "PAY_CARD", title: "💳 Card Payment"      },
        ]);
      } else if (order_type === "takeaway") {
        await sendButtons(phone, billText, [
          { id: "PAY_COD",  title: "💵 Cash on Pickup"   },
          { id: "PAY_UPI",  title: "📲 UPI Payment"      },
          { id: "PAY_CARD", title: "💳 Card Payment"      },
        ]);
      } else {
        await sendButtons(phone, billText, [
          { id: "PAY_REST", title: "🍽️ Pay at Restaurant" },
          { id: "PAY_UPI",  title: "📲 UPI Payment"      },
          { id: "PAY_CARD", title: "💳 Card Payment"      },
        ]);
      }

      return res.status(200).send(
        encryptResponse({ screen: "SUCCESS", data: { status: "payment_pending" } }, aesKey, iv)
      );
    }

    console.log("⚠️ Unhandled:", { action, screen });
    return res.status(200).send(encryptResponse({ data: { status: "active" } }, aesKey, iv));

  } catch (err) {
    console.error("❌ Flow error:", err.message, err.stack);
    return res.status(200).json({ error: "Server Error" });
  }
});

module.exports = router;