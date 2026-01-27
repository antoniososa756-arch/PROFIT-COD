const express = require("express");
const crypto = require("crypto");

const router = express.Router();

/**
 * Shopify Webhook – orders/create
 * RAW BODY obligatorio
 */
router.post(
  "/orders",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      console.log("📦 WEBHOOK LLAMADO");

      const hmac = req.headers["x-shopify-hmac-sha256"];
      const body = req.body;

      if (!hmac || !body) {
        console.error("❌ Falta HMAC o body");
        return res.status(400).send("Webhook inválido");
      }

      const generatedHmac = crypto
        .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
        .update(body)
        .digest("base64");

      const valid =
        Buffer.byteLength(generatedHmac) === Buffer.byteLength(hmac) &&
        crypto.timingSafeEqual(
          Buffer.from(generatedHmac),
          Buffer.from(hmac)
        );

      if (!valid) {
        console.error("❌ HMAC inválido");
        return res.status(401).send("HMAC inválido");
      }

      const payload = JSON.parse(body.toString("utf8"));

      console.log("✅ Pedido recibido:", payload.id);

      // 👉 aquí luego guardaremos el pedido

      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Webhook error:", err);
      res.status(500).send("Error webhook");
    }
  }
);

module.exports = router;
