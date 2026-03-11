const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const router = express.Router();

// Función para verificar HMAC y obtener tienda
function verifyAndGetShop(req, res, callback) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  let shopDomain = req.headers["x-shopify-shop-domain"];
  const topic = req.headers["x-shopify-topic"];
  const body = req.body;

  if (!hmac || !body || !shopDomain) {
    return res.status(400).send("Webhook inválido");
  }

  shopDomain = shopDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();

  console.log(`📦 WEBHOOK: ${topic} de ${shopDomain}`);

  db.get(
    "SELECT id, app_secret FROM shops WHERE LOWER(shop_domain) = ? AND status = 'active'",
    [shopDomain],
    (err, shop) => {
      if (err || !shop) {
        console.warn("⚠️ Tienda no encontrada:", shopDomain);
        return res.status(200).send("OK");
      }

      const generatedHmac = crypto
        .createHmac("sha256", shop.app_secret)
        .update(body)
        .digest("base64");

      const valid =
        Buffer.byteLength(generatedHmac) === Buffer.byteLength(hmac) &&
        crypto.timingSafeEqual(
          Buffer.from(generatedHmac),
          Buffer.from(hmac)
        );

      if (!valid) {
        console.error("❌ HMAC inválido para:", shopDomain);
        return res.status(401).send("HMAC inválido");
      }

      const payload = JSON.parse(body.toString("utf8"));
      callback(shop, payload, topic);
    }
  );
}

// Mapear estado de Shopify a estado logístico de PROFICOD
function mapStatus(o) {
  if (o.cancelled_at) return "cancelado";
  if (o.financial_status === "refunded") return "devuelto";

  const fs = o.fulfillment_status;
  if (!fs || fs === "null" || fs === null) return "pendiente";
  if (fs === "fulfilled") return "enviado";
  if (fs === "partial") return "en_preparacion";
  return fs;
}

// Ruta principal — recibe TODOS los webhooks
router.post(
  "/orders",
  express.raw({ type: "application/json" }),
  (req, res) => {
    verifyAndGetShop(req, res, (shop, o, topic) => {

      // ─── ORDERS/CREATE ───────────────────────────────────────
      if (topic === "orders/create") {
        const status = mapStatus(o);
        const tracking = o.fulfillments?.[0]?.tracking_number || null;

        db.run(
          `INSERT OR IGNORE INTO orders (
            shop_id, order_id, order_number, created_at,
            customer_name, total_price, currency,
            fulfillment_status, tracking_number, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            shop.id,
            String(o.id),
            o.name,
            o.created_at,
            o.customer
              ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
              : "Cliente",
            parseFloat(o.total_price || 0),
            o.currency,
            status,
            tracking,
            JSON.stringify(o),
          ],
          function(err) {
            if (err) console.error("❌ Error INSERT pedido:", err.message);
            else console.log("✅ Pedido creado en DB:", o.name);
          }
        );
      }

      // ─── ORDERS/UPDATED ──────────────────────────────────────
      else if (topic === "orders/updated") {
        const status = mapStatus(o);
        const tracking = o.fulfillments?.[0]?.tracking_number || null;

        db.run(
          `UPDATE orders SET
            fulfillment_status = ?,
            tracking_number = ?,
            raw_json = ?,
            updated_at = datetime('now')
          WHERE order_id = ?`,
          [status, tracking, JSON.stringify(o), String(o.id)],
          function(err) {
            if (err) console.error("❌ Error UPDATE pedido:", err.message);
            else console.log(`✅ Pedido actualizado: ${o.name} → ${status} | tracking: ${tracking || "-"}`);
          }
        );
      }

      // ─── FULFILLMENTS/CREATE o FULFILLMENTS/UPDATE ───────────
      else if (topic === "fulfillments/create" || topic === "fulfillments/update") {
        const tracking = o.tracking_number || o.tracking_numbers?.[0] || null;
        const orderId = String(o.order_id);

        // Determinar estado según tracking y estado del fulfillment
        let status = "enviado";
        if (o.shipment_status === "delivered") status = "entregado";
        else if (o.shipment_status === "failure" || o.shipment_status === "returned") status = "devuelto";
        else if (o.status === "cancelled") status = "cancelado";

        db.run(
          `UPDATE orders SET
            fulfillment_status = ?,
            tracking_number = ?,
            updated_at = datetime('now')
          WHERE order_id = ?`,
          [status, tracking, orderId],
          function(err) {
            if (err) console.error("❌ Error UPDATE fulfillment:", err.message);
            else console.log(`✅ Fulfillment actualizado: order ${orderId} → ${status} | tracking: ${tracking || "-"}`);
          }
        );
      }

      res.status(200).send("OK");
    });
  }
);

module.exports = router;