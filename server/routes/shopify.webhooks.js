const express = require("express");
const crypto = require("crypto");

const router = express.Router();

router.post(
  "/orders",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
      const shop = req.get("X-Shopify-Shop-Domain");

      if (!shop) {
        return res.status(400).send("Missing shop header");
      }

      // 🔎 Buscar tienda en BD
      const store = await req.db.get(
        "SELECT webhook_secret FROM shops WHERE domain = ? AND status = 'active'",
        [shop]
      );

      if (!store || !store.webhook_secret) {
        return res.status(401).send("Webhook secret not found");
      }

      // 🔐 Validar HMAC con el secret DE ESA TIENDA
      const generatedHmac = crypto
        .createHmac("sha256", store.webhook_secret)
        .update(req.body)
        .digest("base64");

      if (generatedHmac !== hmacHeader) {
        console.error("❌ HMAC inválido para", shop);
        return res.status(401).send("Invalid HMAC");
      }

      const payload = JSON.parse(req.body.toString());

      console.log("✅ Pedido recibido:", payload.id);

      // 👉 AQUÍ VA EL GUARDADO DEL PEDIDO (PASO 2)
      res.status(200).send("OK");

    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).send("Webhook error");
    }
  }
);

module.exports = router;
