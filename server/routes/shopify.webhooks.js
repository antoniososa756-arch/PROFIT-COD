const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

router.post(
  "/orders",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      console.log("📦 WEBHOOK LLAMADO");

      const hmac = req.headers["x-shopify-hmac-sha256"];
      const shopDomain = req.headers["x-shopify-shop-domain"];
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

      const o = JSON.parse(body.toString("utf8"));
      console.log("✅ Pedido recibido:", o.id, "de", shopDomain);

      // Buscar la tienda en DB para obtener shop_id
      db.get(
        "SELECT id FROM shops WHERE shop_domain = ? AND status = 'active'",
        [shopDomain],
        async (err, shop) => {
          if (err || !shop) {
            console.warn("⚠️ Tienda no encontrada para webhook:", shopDomain);
            return res.status(200).send("OK"); // siempre 200 a Shopify
          }

          try {
            await db.run(
              `INSERT OR IGNORE INTO orders (
                shop_id, order_id, order_number, created_at,
                customer_name, total_price, currency,
                fulfillment_status, tracking_number, raw_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                shop.id,
                o.id,
                o.name,
                o.created_at,
                o.customer
                  ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
                  : "Cliente",
                parseFloat(o.total_price || 0),
                o.currency,
                o.fulfillment_status || "pendiente",
                o.fulfillments?.[0]?.tracking_number || null,
                JSON.stringify(o),
              ]
            );
            console.log("✅ Pedido guardado en DB:", o.name);
          } catch (e) {
            console.error("❌ Error guardando pedido:", e.message);
          }

          res.status(200).send("OK");
        }
      );
    } catch (err) {
      console.error("❌ Webhook error:", err);
      res.status(500).send("Error webhook");
    }
  }
);

module.exports = router;