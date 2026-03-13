const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const router = express.Router();

function mapStatus(o) {
  if (o.cancelled_at) return "cancelado";
  if (o.financial_status === "refunded") return "devuelto";
  const fs = o.fulfillment_status;
  if (!fs || fs === "null" || fs === null) return "pendiente";
  if (fs === "fulfilled") return "enviado";
  if (fs === "partial") return "en_preparacion";
  return fs;
}

router.post("/orders", express.raw({ type: "application/json" }), async (req, res) => {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  let shopDomain = req.headers["x-shopify-shop-domain"];
  const topic = req.headers["x-shopify-topic"];
  const body = req.body;

  if (!hmac || !body || !shopDomain) return res.status(400).send("Webhook inválido");

  shopDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();

  try {
    const shop = await db.get("SELECT id, app_secret FROM shops WHERE LOWER(shop_domain) = ? AND status = 'active'", [shopDomain]);
    if (!shop) return res.status(200).send("OK");

    const generatedHmac = crypto.createHmac("sha256", shop.app_secret).update(body).digest("base64");
    const valid = Buffer.byteLength(generatedHmac) === Buffer.byteLength(hmac) &&
      crypto.timingSafeEqual(Buffer.from(generatedHmac), Buffer.from(hmac));
    if (!valid) return res.status(401).send("HMAC inválido");

    const o = JSON.parse(body.toString("utf8"));

    if (topic === "orders/create") {
      const status = mapStatus(o);
      const tracking = o.fulfillments?.[0]?.tracking_number || null;
      await db.run(
        `INSERT INTO orders (shop_id, order_id, order_number, created_at, customer_name, total_price, currency, fulfillment_status, tracking_number, raw_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(order_id) DO NOTHING`,
        [shop.id, String(o.id), o.name, o.created_at,
          o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : "Cliente",
          parseFloat(o.total_price || 0), o.currency, status, tracking, JSON.stringify(o)]
      );
    } else if (topic === "orders/updated") {
      const status = mapStatus(o);
      const tracking = o.fulfillments?.[0]?.tracking_number || null;
      await db.run(
        `UPDATE orders SET fulfillment_status = ?, tracking_number = ?, raw_json = ?, updated_at = now()::text WHERE order_id = ?`,
        [status, tracking, JSON.stringify(o), String(o.id)]
      );
    } else if (topic === "fulfillments/create" || topic === "fulfillments/update") {
      const tracking = o.tracking_number || o.tracking_numbers?.[0] || null;
      let status = "enviado";
      if (o.shipment_status === "delivered") status = "entregado";
      else if (o.shipment_status === "failure" || o.shipment_status === "returned") status = "devuelto";
      else if (o.status === "cancelled") status = "cancelado";
      await db.run(
        `UPDATE orders SET fulfillment_status = ?, tracking_number = ?, updated_at = now()::text WHERE order_id = ?`,
        [status, tracking, String(o.order_id)]
      );
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(200).send("OK");
  }
});

module.exports = router;
