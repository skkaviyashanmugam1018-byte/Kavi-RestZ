const axios = require("axios");
require("dotenv").config();

const getBaseUrl = () =>
  `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v25.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const HEADERS = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
  "Content-Type": "application/json",
});

// ─── Send plain text ──────────────────────────────────────
async function sendText(to, text) {
  await axios.post(
    getBaseUrl(),
    { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
    { headers: HEADERS() }
  );
}

// ─── Send reply buttons ───────────────────────────────────
async function sendButtons(to, bodyText, buttons) {
  await axios.post(
    getBaseUrl(),
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    },
    { headers: HEADERS() }
  );
}

// ─── Send list message ────────────────────────────────────
async function sendList(to, headerText, bodyText, buttonText, sections) {
  await axios.post(
    getBaseUrl(),
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: headerText },
        body: { text: bodyText },
        action: { button: buttonText, sections },
      },
    },
    { headers: HEADERS() }
  );
}

// ─── Send Image ───────────────────────────────────────────
async function sendImage(to, imageUrl, caption = "") {
  try {
    await axios.post(
      getBaseUrl(),
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "image",
        image: { link: imageUrl, caption },
      },
      { headers: HEADERS() }
    );
  } catch (err) {
    console.error("❌ sendImage error:", err.response?.data || err.message);
  }
}

// ─── Send WhatsApp Catalogue ──────────────────────────────
async function sendCatalogueMessage(to) {
  try {
    await axios.post(
      getBaseUrl(),
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "catalog_message",
          body: {
            text: "🍽️ *Kavi Chettinadu Restaurant*\n\nஎங்கள் menu பாருங்க! விரும்பியதை cart-ல போட்டு order பண்ணுங்க 😊",
          },
          footer: {
            text: "Rameswaram | 📞 9585960612",
          },
          action: {
            name: "catalog_message",
            parameters: {
              thumbnail_product_retailer_id: "BIRY002",
            },
          },
        },
      },
      { headers: HEADERS() }
    );
    console.log("✅ Catalogue message sent to:", to);
  } catch (err) {
    console.error("❌ sendCatalogue error:", err.response?.data || err.message);
  }
}

// ─── Send WhatsApp Order Flow ─────────────────────────────
// இது "Hi" message வரும்போது trigger ஆகும்
// Flow-ல் Category → Items → Delivery Details → Summary → Confirm
async function sendOrderFlow(to) {
  try {
    const flowToken = `order_${to}_${Date.now()}`;

    await axios.post(
      getBaseUrl(),
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "flow",
          header: {
            type: "text",
            text: "🍛 Kavi Chettinadu Restaurant",
          },
          body: {
            text: "Taste The Tradition! 🏛️\n\nஉங்கள் order-ஐ இப்போதே பண்ணுங்கள் 👇",
          },
          footer: {
            text: "📍 Rameswaram | 📞 9585960612",
          },
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token: flowToken,
              flow_id: process.env.FLOW_ID,
              flow_cta: "🛒 Order Now",
              flow_action: "navigate",
              flow_action_payload: {
                screen: "CATEGORY_SELECT",
                data: {},
              },
            },
          },
        },
      },
      { headers: HEADERS() }
    );
    console.log("✅ Order Flow sent to:", to);
  } catch (err) {
    console.error("❌ sendOrderFlow error:", err.response?.data || err.message);
  }
}

// ─── Send Order Confirmation ──────────────────────────────
async function sendOrderConfirmation(to, order) {
  const itemsList = order.items
    .map((i) => `• ${i.name} × ${i.quantity} = ₹${i.price * i.quantity}`)
    .join("\n");

  const paymentLabel =
    order.paymentMethod === "UPI"
      ? "📲 UPI / QR Code (Paid)"
      : "💵 Cash on Delivery";

  await sendText(
    to,
    `🎉 *ORDER PLACED SUCCESSFULLY!*\n\n` +
    `📋 *Order ID:* #${order.orderId}\n` +
    `─────────────────\n` +
    `*Items:*\n${itemsList}\n` +
    `─────────────────\n` +
    `💰 *Total: ₹${order.totalAmount}*\n` +
    `💳 *Payment:* ${paymentLabel}\n` +
    `🚚 *Type:* ${order.orderType || "Home Delivery"}\n` +
    `🏠 *Address:* ${order.address}\n` +
    `─────────────────\n` +
    `⏱️ Est. Delivery: 30-45 mins\n\n` +
    `Thank you for ordering from Kavi Chettinadu! 🙏`
  );

  await sendButtons(to, "What would you like to do next?", [
    { id: "PLACE_ORDER_FLOW", title: "🔄 Order Again" },
    { id: "EXIT", title: "❌ Exit" },
  ]);
}

module.exports = {
  sendText,
  sendButtons,
  sendList,
  sendImage,
  sendCatalogueMessage,
  sendOrderFlow,
  sendOrderConfirmation,
};