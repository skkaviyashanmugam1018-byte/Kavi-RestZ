const axios = require("axios");

// ── URL is built at call time so .env loads first ───────────────────────────
const getApiUrl = () =>
  `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v20.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const headers = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
  "Content-Type": "application/json",
});

// ── Debug helper — prints env values on every send ──────────────────────────
const debugEnv = () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 PHONE_NUMBER_ID :", process.env.WHATSAPP_PHONE_NUMBER_ID  || "❌ MISSING");
  console.log("🔍 API_TOKEN       :", process.env.WHATSAPP_API_TOKEN ? "✅ present" : "❌ MISSING");
  console.log("🔍 API_URL         :", getApiUrl());
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
};

// ── Send plain text message ──────────────────────────────────────────────────
const sendText = async (to, text) => {
  debugEnv();
  console.log("📤 sendText →", to);

  try {
    const res = await axios.post(
      getApiUrl(),
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      },
      { headers: headers() }
    );
    console.log("✅ sendText success:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendText error:");
    console.error(JSON.stringify(err.response?.data || err.message, null, 2));
    throw err;
  }
};

// ── Send interactive button message (max 3 buttons) ─────────────────────────
const sendButtons = async (to, bodyText, buttons, headerText = null) => {
  debugEnv();
  console.log("📤 sendButtons →", to);
  console.log("📤 Buttons:", buttons.map((b) => b.title));

  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((btn) => ({
            type: "reply",
            reply: {
              id:    btn.id,
              title: btn.title.substring(0, 20),
            },
          })),
        },
      },
    };

    if (headerText) {
      payload.interactive.header = { type: "text", text: headerText };
    }

    const res = await axios.post(getApiUrl(), payload, { headers: headers() });
    console.log("✅ sendButtons success:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendButtons error:");
    console.error(JSON.stringify(err.response?.data || err.message, null, 2));
    throw err;
  }
};

// ── Send interactive list message ────────────────────────────────────────────
const sendList = async (to, bodyText, buttonLabel, sections) => {
  debugEnv();
  console.log("📤 sendList →", to);

  try {
    const res = await axios.post(
      getApiUrl(),
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: bodyText },
          action: {
            button: buttonLabel,
            sections: sections.map((section) => ({
              title: section.title.substring(0, 24),
              rows: section.rows.map((row) => ({
                id:          row.id,
                title:       row.title.substring(0, 24),
                description: (row.description || "").substring(0, 72),
              })),
            })),
          },
        },
      },
      { headers: headers() }
    );
    console.log("✅ sendList success:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendList error:");
    console.error(JSON.stringify(err.response?.data || err.message, null, 2));
    throw err;
  }
};

module.exports = { sendText, sendButtons, sendList };