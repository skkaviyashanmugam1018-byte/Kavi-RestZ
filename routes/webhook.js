const express = require("express");
const router = express.Router();
const { handleMessage } = require("../controllers/botController");

// ── GET /webhook — Meta verification ─────────────────────
router.get("/", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta");
    return res.status(200).send(challenge);
  }
  console.log("❌ Webhook verification failed");
  return res.sendStatus(403);
});

// ── POST /webhook — Incoming WhatsApp Messages ────────────
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    const entry    = body.entry?.[0];
    const changes  = entry?.changes?.[0];
    const value    = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return res.sendStatus(200);
    }

    const msg  = messages[0];
    const from = msg.from;

    // ✅ Extract WhatsApp profile name
    const contactName = value?.contacts?.[0]?.profile?.name || "";
    if (contactName) console.log(`👤 WhatsApp Name: ${contactName}`);

    let messageBody      = "";
    let interactiveReply = null;
    let locationData     = null;
    let catalogueOrder   = null;

    // ── Text ──────────────────────────────────────────────
    if (msg.type === "text") {
      messageBody = msg.text?.body || "";
    }

    // ── Interactive ───────────────────────────────────────
    else if (msg.type === "interactive") {
      if (msg.interactive?.type === "button_reply") {
        interactiveReply = msg.interactive.button_reply;
      } else if (msg.interactive?.type === "list_reply") {
        interactiveReply = msg.interactive.list_reply;
      } else if (msg.interactive?.type === "nfm_reply") {
        // ✅ Flow complete — extract response_json
        console.log("📋 Flow nfm_reply received!");
        const responseJson = msg.interactive?.nfm_reply?.response_json;
        console.log("📦 Raw response_json:", responseJson);
        if (responseJson) {
          try {
            const flowData = JSON.parse(responseJson);
            console.log("✅ Flow data parsed:", JSON.stringify(flowData, null, 2));
            interactiveReply = { id: "__FLOW_COMPLETE__", flowData };
          } catch (e) {
            console.error("❌ Parse error:", e.message);
          }
        }
      }
    }

    // ── Catalogue Order ───────────────────────────────────
    else if (msg.type === "order") {
      catalogueOrder = msg.order;
      console.log("🛒 Catalogue order received:", JSON.stringify(catalogueOrder, null, 2));
    }

    // ── Location ──────────────────────────────────────────
    else if (msg.type === "location") {
      const loc = msg.location;
      locationData = {
        lat:     loc.latitude,
        lng:     loc.longitude,
        address: loc.address || loc.name || `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`,
      };
      console.log("📍 Location received:", locationData);
    }

    console.log("\n📩 Incoming WhatsApp Message");
    console.log("👤 From:", from);
    console.log("💬 Message:", messageBody);
    console.log("⚡ Interactive:", interactiveReply);

    await handleMessage(from, messageBody, interactiveReply, locationData, catalogueOrder, contactName);

    return res.sendStatus(200);

  } catch (err) {
    console.error("\n❌ Webhook Processing Error");
    if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
    return res.sendStatus(200);
  }
});

module.exports = router;
