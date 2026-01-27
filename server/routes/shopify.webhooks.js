const express = require("express");
const crypto = require("crypto");

const router = express.Router();

/**
 * Shopify webhooks → RAW BODY obligatorio
 */
router.post(
  "/orders-create",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const hmac = req.headers["x-shopify-hmac-sha256"];
      const body = req.body;

      if (!hmac || !body) {
        return res.status(400).send("Webhook inválido");
      }

      const generatedHmac = crypto
        .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
        .update(body)
        .digest("base64");

      // comparación segura
      const valid =
        Buffer.from(generatedHmac, "utf8").length ===
          Buffer.from(hmac, "utf8").length &&
        crypto.timingSafeEqual(
          Buffer.from(generatedHmac, "utf8"),
          Buffer.from(hmac, "utf8")
        );

      if (!valid) {
        return res.status(401).send("HMAC inválido");
      }

      const data = JSON.parse(body.toString());

      console.log("✅ Webhook pedido recibido:", data.id);

      // 👉 aquí luego guardamos el pedido en DB

      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Webhook error:", err);
      res.status(500).send("Error webhook");
    }
  }
);

module.exports = router;
