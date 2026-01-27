const express = require("express");
const crypto = require("crypto");

const router = express.Router();

/**
 * ⚠️ IMPORTANTE
 * - Shopify envía RAW body
 * - NO usar express.json() aquí
 */
router.post(
  "/orders",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      console.log("📦 WEBHOOK LLAMADO");

      const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
      const shopDomain = req.get("X-Shopify-Shop-Domain");
      const body = req.body;

      if (!hmacHeader || !shopDomain || !body) {
        return res.status(400).send("Webhook inválido");
      }

      // 1️⃣ Buscar app_secret de la tienda
      const shop = await req.db.get(
        `
        SELECT app_secret
        FROM shops
        WHERE shop_domain = ? AND status = 'active'
        `,
        [shopDomain]
      );

      if (!shop || !shop.app_secret) {
        console.error("❌ App secret no encontrado para", shopDomain);
        return res.status(401).send("Tienda no autorizada");
      }

      // 2️⃣ Calcular HMAC con el APP SECRET del cliente
      const generatedHmac = crypto
        .createHmac("sha256", shop.app_secret)
        .update(body)
        .digest("base64");

      const valid =
        Buffer.byteLength(generatedHmac) ===
          Buffer.byteLength(hmacHeader) &&
        crypto.timingSafeEqual(
          Buffer.from(generatedHmac),
          Buffer.from(hmacHeader)
        );

      if (!valid) {
        console.error("❌ HMAC inválido para", shopDomain);
        return res.status(401).send("HMAC inválido");
      }

      // 3️⃣ Payload válido
      const payload = JSON.parse(body.toString());

      console.log(
        "✅ Pedido recibido:",
        payload.id,
        "Tienda:",
        shopDomain
      );

      // 👉 AQUÍ IRÁ:
      // await saveOrder(payload, shopDomain)

      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Webhook error:", err);
      res.status(500).send("Error webhook");
    }
  }
);

module.exports = router;
