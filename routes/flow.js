const express = require("express");
const router  = express.Router();
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const Order   = require("../models/Order");
const Session = require("../models/Session");
const { sendButtons, sendText } = require("../config/whatsapp");

// ── Load Private Key ──────────────────────────────────────
const privateKey = process.env.PRIVATE_KEY
  ? process.env.PRIVATE_KEY.replace(/\\n/g, "\n")
  : fs.readFileSync(path.join(__dirname, "../private.pem"), "utf8");

// ── Decrypt ───────────────────────────────────────────────
function decryptRequest(body) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;
  const decryptedAesKey = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(encrypted_aes_key, "base64")
  );
  const iv            = Buffer.from(initial_vector, "base64");
  const encryptedData = Buffer.from(encrypted_flow_data, "base64");
  const TAG_LENGTH    = 16;
  const encryptedBody = encryptedData.slice(0, -TAG_LENGTH);
  const authTag       = encryptedData.slice(-TAG_LENGTH);
  const decipher      = crypto.createDecipheriv("aes-128-gcm", decryptedAesKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = decipher.update(encryptedBody, undefined, "utf8") + decipher.final("utf8");
  return { decryptedBody: JSON.parse(decrypted), aesKey: decryptedAesKey, iv };
}

// ── Encrypt ───────────────────────────────────────────────
function encryptResponse(response, aesKey, iv) {
  const flippedIv = Buffer.alloc(iv.length);
  for (let i = 0; i < iv.length; i++) flippedIv[i] = ~iv[i];
  const cipher    = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(response), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return encrypted.toString("base64");
}

// ── Addon price map ───────────────────────────────────────
const ADDON_PRICES = {
  raita:       { name: "Raita",         price: 30 },
  pickle:      { name: "Pickle",        price: 20 },
  papad:       { name: "Papad",         price: 20 },
  extra_gravy: { name: "Extra Gravy",   price: 50 },
  salad:       { name: "Salad",         price: 40 },
  curd_rice:   { name: "Curd Rice",     price: 60 },
  sweet:       { name: "Sweet (Kheer)", price: 50 },
};

// ── Flow Endpoint ─────────────────────────────────────────
router.post("/endpoint", async (req, res) => {
  try {
    const body = req.body;

    // Unencrypted Ping
    if (body?.action === "ping") {
      console.log("✅ Health check ping");
      return res.status(200).json({ data: { status: "active" } });
    }

    // Missing encrypted fields
    if (!body?.encrypted_aes_key || !body?.encrypted_flow_data || !body?.initial_vector) {
      return res.status(200).json({ data: { status: "active" } });
    }

    // Decrypt
    let decryptedBody, aesKey, iv;
    try {
      ({ decryptedBody, aesKey, iv } = decryptRequest(body));
    } catch (err) {
      console.error("❌ Decrypt error:", err.message);
      return res.status(421).json({ error: "Decryption failed" });
    }

    const { flow_token, data, action, screen } = decryptedBody;
    console.log("📩 Flow:", JSON.stringify({ action, screen, flow_token }, null, 2));

    // Encrypted Ping
    if (action === "ping") {
      return res.status(200).send(
        encryptResponse({ data: { status: "active" } }, aesKey, iv)
      );
    }

    // ✅ FIX: Always use phone from flow_token (reliable — set by us when sending flow)
    // flow_token format: "delivery_917904307757_1735123456789"
    const tokenParts = (flow_token || "").split("_");
    const phone = tokenParts.length >= 2 ? tokenParts[1] : null;
    console.log(`📞 Phone from flow_token: ${phone}`);

    // ── DELIVERY_DETAILS → ADDONS_SELECT ─────────────────
    if (screen === "DELIVERY_DETAILS") {
      return res.status(200).send(
        encryptResponse({
          screen: "ADDONS_SELECT",
          data: {
            customer_name:    data.customer_name    || "",
            customer_phone:   data.customer_phone   || "",
            order_type:       data.order_type       || "delivery",
            delivery_address: data.delivery_address || "",
            delivery_time:    data.delivery_time    || "asap",
            scheduled_time:   data.scheduled_time   || "",
            cart_summary:     data.cart_summary     || "",
            total_amount:     data.total_amount     || "",
          }
        }, aesKey, iv)
      );
    }

    // ── ADDONS_SELECT → ORDER_SUMMARY ─────────────────────
    if (screen === "ADDONS_SELECT") {
      return res.status(200).send(
        encryptResponse({
          screen: "ORDER_SUMMARY",
          data: {
            ...data,
            selected_addons:      data.selected_addons      || [],
            special_instructions: data.special_instructions || "",
          }
        }, aesKey, iv)
      );
    }

    // ── COMPLETE → Save session + Send payment options ────
    if (action === "complete") {
      const {
        customer_name, customer_phone,
        delivery_address, order_type,
        delivery_time, scheduled_time,
        selected_addons, special_instructions,
        total_amount,
      } = data;

      // ✅ FIX: Use phone from flow_token — NOT from form input
      // User may type 9585960612 (without 91), but session stored as 919585960612
      const sessionPhone = phone; // from flow_token — always correct

      // Calculate addon prices
      const addonList  = Array.isArray(selected_addons) ? selected_addons : [];
      const addonItems = addonList.map((id) => ADDON_PRICES[id]).filter(Boolean);
      const addonTotal = addonItems.reduce((s, a) => s + a.price, 0);
      const baseTotal  = parseFloat(String(total_amount || "0").replace(/[^0-9.]/g, "")) || 0;
      const grandTotal = baseTotal + addonTotal;

      // Addon text
      const addonText = addonItems.length > 0
        ? addonItems.map((a) => `${a.name} (Rs.${a.price})`).join(", ")
        : "None";

      // Time text
      const timeText = delivery_time === "schedule" && scheduled_time
        ? `📅 Scheduled: ${scheduled_time}`
        : "⚡ ASAP (30-45 mins)";

      // Order type label
      const orderTypeLabel =
        order_type === "delivery" ? "🚚 Home Delivery" :
        order_type === "takeaway" ? "🥡 Take Away"     : "🍽️ Dine In";

      // ✅ Update session using flow_token phone
      let session = await Session.findOne({ phoneNumber: sessionPhone });
      if (session) {
        session.deliveryData = {
          name:                 customer_name     || "Customer",
          phone:                customer_phone    || sessionPhone,
          address:              delivery_address  || "",
          order_type,
          delivery_time,
          scheduled_time,
          addons:               addonItems,
          addon_total:          addonTotal,
          special_instructions,
          grand_total:          grandTotal,
        };
        session.state = "PAYMENT_SELECT";
        session.markModified("deliveryData");
        await session.save();
        console.log(`✅ Session updated for ${sessionPhone} | Grand Total: Rs.${grandTotal}`);
      } else {
        console.error(`❌ Session not found for phone: ${sessionPhone}`);
      }

      // ✅ Send payment options to flow_token phone
      if (sessionPhone) {
        try {
          await sendButtons(
            sessionPhone,
            `✅ *Order details saved!*\n\n` +
            `👤 *Name:* ${customer_name}\n` +
            `📞 *Phone:* ${customer_phone}\n` +
            `🚚 *Type:* ${orderTypeLabel}\n` +
            `🏠 *Address:* ${delivery_address || "N/A"}\n` +
            `⏰ *Time:* ${timeText}\n` +
            `🍱 *Add-ons:* ${addonText}\n` +
            `📝 *Note:* ${special_instructions || "None"}\n` +
            `─────────────────\n` +
            `🛒 *Items:* Rs.${baseTotal}\n` +
            (addonTotal > 0 ? `🍱 *Add-ons:* Rs.${addonTotal}\n` : "") +
            `💰 *Grand Total: Rs.${grandTotal}*\n\n` +
            `Select payment method:`,
            [
              { id: "PAY_COD",  title: "💵 Cash on Delivery" },
              { id: "PAY_UPI",  title: "📲 UPI Payment"      },
              { id: "PAY_CARD", title: "💳 Card Payment"      },
            ]
          );
          console.log(`✅ Payment options sent to ${sessionPhone}`);
        } catch (msgErr) {
          console.error("❌ Payment options send error:", msgErr.message);
        }
      }

      return res.status(200).send(
        encryptResponse(
          { screen: "SUCCESS", data: { status: "payment_pending", total: grandTotal } },
          aesKey, iv
        )
      );
    }

    // Default
    return res.status(200).send(
      encryptResponse({ data: { status: "active" } }, aesKey, iv)
    );

  } catch (err) {
    console.error("❌ Flow error:", err.message);
    return res.status(200).json({ error: "Server Error" });
  }
});

module.exports = router;