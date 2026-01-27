const express = require("express");
const crypto = require("crypto");

const router = express.Router();

// Shopify necesita RAW body
router.post(
  "/orders",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
      const body = req.body;

      const generatedHmac = crypto
        .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
        .update(body, "utf8")
        .digest("base64");

      if (generatedHmac !== hmacHeader) {
        console.error("❌ HMAC inválido");
        return res.status(401).send("HMAC inválido");
      }

      const payload = JSON.parse(body.toString());

      console.log("✅ WEBHOOK OK:", payload.id);

      // AQUÍ luego guardaremos el pedido
      res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).send("Error webhook");
    }
  }
);

module.exports = router;
