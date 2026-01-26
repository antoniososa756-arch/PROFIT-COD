const express = require("express");
const crypto = require("crypto");

const router = express.Router();

// Shopify exige raw body
router.post(
  "/orders",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const hmac = req.headers["x-shopify-hmac-sha256"];
      const topic = req.headers["x-shopify-topic"];
      const shop = req.headers["x-shopify-shop-domain"];

      const digest = crypto
        .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
        .update(req.body, "utf8")
        .digest("base64");

      if (digest !== hmac) {
        return res.sendStatus(401);
      }

      const payload = JSON.parse(req.body.toString());

      // 👉 aquí luego procesamos según topic
      console.log("📦 WEBHOOK", topic, shop);

      res.sendStatus(200);
    } catch (e) {
      console.error("Webhook error", e);
      res.sendStatus(500);
    }
  }
);

module.exports = router;
