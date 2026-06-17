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
  try {
    await axios.post(getBaseUrl(),
      { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
      { headers: HEADERS() }
    );
  } catch (err) {
    console.error("❌ sendText error:", err.response?.data || err.message);
  }
}

// ─── Send reply buttons (max 3) ───────────────────────────
async function sendButtons(to, bodyText, buttons) {
  try {
    await axios.post(getBaseUrl(),
      {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
          type: "button", body: { text: bodyText },
          action: {
            buttons: buttons.slice(0, 3).map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title.substring(0, 20) },
            })),
          },
        },
      },
      { headers: HEADERS() }
    );
  } catch (err) {
    console.error("❌ sendButtons error:", err.response?.data || err.message);
  }
}

// ─── Send list message ────────────────────────────────────
async function sendList(to, headerText, bodyText, buttonText, sections) {
  try {
    await axios.post(getBaseUrl(),
      {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: headerText },
          body: { text: bodyText },
          action: { button: buttonText, sections },
        },
      },
      { headers: HEADERS() }
    );
  } catch (err) {
    console.error("❌ sendList error:", err.response?.data || err.message);
  }
}

// ─── Send Image ───────────────────────────────────────────
async function sendImage(to, imageUrl, caption = "") {
  try {
    await axios.post(getBaseUrl(),
      {
        messaging_product: "whatsapp", recipient_type: "individual",
        to, type: "image", image: { link: imageUrl, caption },
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
    const catalogueId = process.env.CATALOGUE_ID;
    if (!catalogueId) { console.warn("⚠️ CATALOGUE_ID not set"); return false; }
    await axios.post(getBaseUrl(),
      {
        messaging_product: "whatsapp", recipient_type: "individual",
        to, type: "interactive",
        interactive: {
          type: "catalog_message",
          body: { text: "🍽️ Browse our full Kavi Chettinadu menu!\n\nTap any item to add to cart. 🛒" },
          footer: { text: "📍 Rameswaram | 📞 95859 60612" },
          action: {
            name: "catalog_message",
            parameters: { thumbnail_product_retailer_id: "GRILL001" },
          },
        },
      },
      { headers: HEADERS() }
    );
    console.log("✅ Catalogue message sent to:", to);
    return true;
  } catch (err) {
    console.error("❌ sendCatalogueMessage error:", err.response?.data || err.message);
    return false;
  }
}

// ─── Send WhatsApp Flow ───────────────────────────────────
async function sendDeliveryFlow(to, cartSummary, totalAmount) {
  try {
    const flowToken = `delivery_${to}_${Date.now()}`;
    await axios.post(getBaseUrl(),
      {
        messaging_product: "whatsapp", recipient_type: "individual",
        to, type: "interactive",
        interactive: {
          type: "flow",
          header: { type: "text", text: "📦 Order Details" },
          body: { text: `Your cart total: *Rs.${totalAmount}*\n\nFill your delivery details below:` },
          footer: { text: "Kavi Chettinadu Restaurant" },
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token: flowToken,
              flow_id: process.env.FLOW_ID,
              flow_cta: "Enter Delivery Details",
              flow_action: "navigate",
              flow_action_payload: {
                screen: "ORDER_TYPE",
                data: {
                  cart_summary:   cartSummary   || "",
                  total_amount:   `Rs.${totalAmount}`,
                  customer_name:  "",
                  customer_phone: "",
                  error_messages: {},
                  init_values:    {},
                },
              },
              mode: "published",
            },
          },
        },
      },
      { headers: HEADERS() }
    );
    console.log("✅ Delivery Flow sent to:", to);
  } catch (err) {
    console.error("❌ sendDeliveryFlow error:", err.response?.data || err.message);
  }
}

module.exports = {
  sendText, sendButtons, sendList, sendImage,
  sendCatalogueMessage, sendDeliveryFlow,
};