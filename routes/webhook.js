const express = require("express");
const router = express.Router();
const { handleMessage } = require("../controllers/botController");

// ── GET /api/webhook — Meta verification ─────────────────────────────
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    console.log("✅ Webhook verified by Meta");
    return res.status(200).send(challenge);
  }

  console.log("❌ Webhook verification failed");
  return res.sendStatus(403);
});

// ── POST /api/webhook — Incoming WhatsApp Messages ───────────────────
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    // Check webhook object
    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    // Extract message data
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    // No messages
    if (!messages || messages.length === 0) {
      return res.sendStatus(200);
    }

    const msg = messages[0];

    const from = msg.from;

    let messageBody = "";
    let interactiveReply = null;

    // ── Text Message ─────────────────────────────
    if (msg.type === "text") {
      messageBody = msg.text?.body || "";
    }

    // ── Interactive Button/List Reply ───────────
    else if (msg.type === "interactive") {

      // Button Reply
      if (msg.interactive?.type === "button_reply") {
        interactiveReply = msg.interactive.button_reply;
      }

      // List Reply
      if (msg.interactive?.type === "list_reply") {
        interactiveReply = msg.interactive.list_reply;
      }
    }

    // ── Logs ────────────────────────────────────
    console.log("\n📩 Incoming WhatsApp Message");
    console.log("👤 From:", from);
    console.log("💬 Message:", messageBody);
    console.log("⚡ Interactive:", interactiveReply);

    // ── Handle Bot Logic ────────────────────────
    
    await handleMessage(from, messageBody, interactiveReply);

    return res.sendStatus(200);

  } catch (err) {

    console.error("\n❌ Webhook Processing Error");

    if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }

    return res.sendStatus(500);
  }
});

module.exports = router;