const express = require("express");
const router  = express.Router();
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const Session = require("../models/Session");
const { sendButtons } = require("../config/whatsapp");

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

// ── Pricing ───────────────────────────────────────────────
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

// ── Flow Endpoint ─────────────────────────────────────────
router.post("/endpoint", async (req, res) => {
  try {
    const body = req.body;
    console.log("📩 Flow endpoint hit | action:", body?.action || "encrypted");

    if (body?.action === "ping") {
      console.log("✅ Health check ping");
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
    console.log("📩 Flow decrypted:", JSON.stringify({ action, screen }, null, 2));

    if (action === "ping") {
      return res.status(200).send(encryptResponse({ data: { status: "active" } }, aesKey, iv));
    }

    const tokenParts = (flow_token || "").split("_");
    const phone = tokenParts.length >= 2 ? tokenParts[1] : null;
    console.log(`📞 Phone: ${phone}`);

    // ── ADDRESS → ORDER_TYPE ──────────────────────────────
    if (screen === "ADDRESS") {
      console.log("📋 ADDRESS → ORDER_TYPE");
      return res.status(200).send(encryptResponse({
        screen: "ORDER_TYPE",
        data: {
          customer_name:   data.customer_name   || "",
          customer_phone:  data.customer_phone  || "",
          alternate_phone: data.alternate_phone || "",
          door_no:         data.door_no         || "",
          street:          data.street          || "",
          area:            data.area            || "",
          pincode:         data.pincode         || "",
          cart_summary:    data.cart_summary    || "",
          total_amount:    data.total_amount    || "",
        }
      }, aesKey, iv));
    }

    // ── ORDER_TYPE → route based on selection ─────────────
    if (screen === "ORDER_TYPE") {
      const orderType = data.order_type || "delivery";
      console.log(`📋 ORDER_TYPE → ${orderType}`);

      const commonData = {
        customer_name:   data.customer_name   || "",
        customer_phone:  data.customer_phone  || "",
        alternate_phone: data.alternate_phone || "",
        door_no:         data.door_no         || "",
        street:          data.street          || "",
        area:            data.area            || "",
        pincode:         data.pincode         || "",
        order_type:      orderType,
        cart_summary:    data.cart_summary    || "",
        total_amount:    data.total_amount    || "",
      };

      // Dine In → Table Booking
      if (orderType === "dine_in") {
        return res.status(200).send(encryptResponse({
          screen: "TABLE_BOOKING",
          data: commonData
        }, aesKey, iv));
      }

      // Delivery → Delivery Options (distance)
      if (orderType === "delivery") {
        return res.status(200).send(encryptResponse({
          screen: "DELIVERY_OPTIONS",
          data: commonData
        }, aesKey, iv));
      }

      // Takeaway → straight to Addons
      return res.status(200).send(encryptResponse({
        screen: "ADDONS_SELECT",
        data: {
          ...commonData,
          within_five_km: "",
          table_persons:  "",
          table_date:     "",
          table_time:     "",
          table_seating:  "",
        }
      }, aesKey, iv));
    }

    // ── DELIVERY_OPTIONS → ADDONS_SELECT ─────────────────
    if (screen === "DELIVERY_OPTIONS") {
      console.log("📋 DELIVERY_OPTIONS → ADDONS_SELECT");
      return res.status(200).send(encryptResponse({
        screen: "ADDONS_SELECT",
        data: {
          customer_name:   data.customer_name   || "",
          customer_phone:  data.customer_phone  || "",
          alternate_phone: data.alternate_phone || "",
          door_no:         data.door_no         || "",
          street:          data.street          || "",
          area:            data.area            || "",
          pincode:         data.pincode         || "",
          order_type:      data.order_type      || "delivery",
          within_five_km:  data.within_five_km  || "yes",
          table_persons:   "",
          table_date:      "",
          table_time:      "",
          table_seating:   "",
          cart_summary:    data.cart_summary    || "",
          total_amount:    data.total_amount    || "",
        }
      }, aesKey, iv));
    }

    // ── TABLE_BOOKING → ADDONS_SELECT ────────────────────
    if (screen === "TABLE_BOOKING") {
      console.log("📋 TABLE_BOOKING → ADDONS_SELECT");
      return res.status(200).send(encryptResponse({
        screen: "ADDONS_SELECT",
        data: {
          customer_name:   data.customer_name   || "",
          customer_phone:  data.customer_phone  || "",
          alternate_phone: data.alternate_phone || "",
          door_no:         data.door_no         || "",
          street:          data.street          || "",
          area:            data.area            || "",
          pincode:         data.pincode         || "",
          order_type:      data.order_type      || "dine_in",
          within_five_km:  "",
          table_persons:   data.table_persons   || "",
          table_date:      data.table_date      || "",
          table_time:      data.table_time      || "",
          table_seating:   data.table_seating   || "",
          cart_summary:    data.cart_summary    || "",
          total_amount:    data.total_amount    || "",
        }
      }, aesKey, iv));
    }

    // ── ADDONS_SELECT → ORDER_SUMMARY ─────────────────────
    if (screen === "ADDONS_SELECT") {
      console.log("📋 ADDONS_SELECT → ORDER_SUMMARY");
      return res.status(200).send(encryptResponse({
        screen: "ORDER_SUMMARY",
        data: {
          ...data,
          selected_addons:      data.selected_addons      || [],
          special_instructions: data.special_instructions || "",
        }
      }, aesKey, iv));
    }

    // ── COMPLETE ──────────────────────────────────────────
    if (action === "complete") {
      console.log("✅ Flow COMPLETE received!");
      console.log("📦 Flow data:", JSON.stringify(data, null, 2));

      const {
        customer_name, customer_phone, alternate_phone,
        door_no, street, area, pincode,
        order_type, within_five_km,
        table_persons, table_date, table_time, table_seating,
        selected_addons, special_instructions, total_amount,
      } = data;

      const delivery_address = [door_no, street, area, pincode ? `- ${pincode}` : null]
        .filter(Boolean).join(", ");

      const sessionPhone = phone;
      const cartTotal    = 0; // will be recalculated in botController from session.cart
      const addonList    = Array.isArray(selected_addons) ? selected_addons : [];
      const addonItems   = addonList.map((id) => ADDON_PRICES[id]).filter(Boolean);
      const addonTotal   = addonItems.reduce((s, a) => s + a.price, 0);
      const isDelivery   = order_type === "delivery";
      const isWithin     = within_five_km === "yes";
      const deliveryCh   = isDelivery ? (isWithin ? 100 : 150) : 0;

      let session = await Session.findOne({ phoneNumber: sessionPhone });
      if (session) {
        const cartItemsTotal = session.cart.reduce((s, i) => s + i.price * i.qty, 0);
        const subtotal       = cartItemsTotal + addonTotal + deliveryCh;
        const gstAmount      = Math.round(subtotal * GST_PERCENT / 100);
        const grandTotal     = subtotal + gstAmount;

        const orderTypeLabel =
          order_type === "delivery" ? "🚚 Home Delivery" :
          order_type === "takeaway" ? "🥡 Take Away"     : "🍽️ Dine In";

        const deliveryLabel = isDelivery
          ? `Rs.${deliveryCh} (${isWithin ? "Within 5km" : "Above 5km"})`
          : "Free";

        const addonText = addonItems.length > 0
          ? addonItems.map((a) => `${a.name} (Rs.${a.price})`).join(", ")
          : "None";

        const tableInfo = order_type === "dine_in" && table_persons
          ? `\n👥 *People:* ${table_persons}\n📅 *Date:* ${table_date}\n🕐 *Time:* ${table_time}\n🪑 *Seating:* ${table_seating === "ac" ? "❄️ AC" : "🌿 Non-AC"}`
          : "";

        session.deliveryData = {
          name:                 customer_name     || "Customer",
          phone:                customer_phone    || sessionPhone,
          alternate_phone:      alternate_phone   || "",
          address:              delivery_address,
          order_type,
          delivery_time:        "asap",
          scheduled_time:       "",
          table_persons:        table_persons     || "",
          table_date:           table_date        || "",
          table_time:           table_time        || "",
          table_seating:        table_seating     || "",
          addons:               addonItems,
          addon_total:          addonTotal,
          delivery_charge:      deliveryCh,
          gst_amount:           gstAmount,
          special_instructions: special_instructions || "",
          grand_total:          grandTotal,
        };
        session.state = "PAYMENT_SELECT";
        session.markModified("deliveryData");
        await session.save();
        console.log(`✅ Session updated | Grand Total: Rs.${grandTotal}`);

        await sendButtons(
          sessionPhone,
          `🧾 *Order Bill Summary*\n\n` +
          `👤 *Customer:* ${customer_name}\n` +
          `📞 *Phone:* ${customer_phone}\n` +
          (alternate_phone ? `📞 *Alt:* ${alternate_phone}\n` : "") +
          `📍 *Address:* ${delivery_address}\n` +
          `🚚 *Type:* ${orderTypeLabel}` +
          tableInfo + "\n" +
          `📝 *Note:* ${special_instructions || "None"}\n` +
          `─────────────────\n` +
          `🛒 *Items:* Rs.${cartItemsTotal}\n` +
          (addonTotal > 0 ? `🍱 *Add-ons:* Rs.${addonTotal} — ${addonText}\n` : "") +
          `🚚 *Delivery:* ${deliveryLabel}\n` +
          `📊 *GST (${GST_PERCENT}%):* Rs.${gstAmount}\n` +
          `─────────────────\n` +
          `💰 *Total: Rs.${grandTotal}*\n\n` +
          `Select payment method:`,
          [
            { id: "PAY_COD",  title: "💵 Cash on Delivery" },
            { id: "PAY_UPI",  title: "📲 UPI Payment"      },
            { id: "PAY_CARD", title: "💳 Card Payment"      },
          ]
        );
        console.log(`✅ Payment options sent to ${sessionPhone}`);
      } else {
        console.error(`❌ Session not found: ${sessionPhone}`);
      }

      return res.status(200).send(
        encryptResponse({ screen: "SUCCESS", data: { status: "payment_pending" } }, aesKey, iv)
      );
    }

    console.log("⚠️ Unhandled:", { action, screen });
    return res.status(200).send(encryptResponse({ data: { status: "active" } }, aesKey, iv));

  } catch (err) {
    console.error("❌ Flow error:", err.message);
    return res.status(200).json({ error: "Server Error" });
  }
});

module.exports = router;