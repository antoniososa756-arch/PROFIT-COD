const express = require("express");
const crypto = require("crypto");

const router = express.Router();

/*
  WEBHOOK SHOPIFY
  Endpoint único para:
  - orders/create
  - orders/updated
  - fulfillments/create
  - fulfillments/update
*/
router.post(
  "/orders",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      // 🔐 Verificar HMAC
      const hmac = req.headers["x-shopify-hmac-sha256"];
      const topic = req.headers["x-shopify-topic"];
      const shopDomain = req.headers["x-shopify-shop-domain"];

      const digest = crypto
        .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
        .update(req.body, "utf8")
        .digest("base64");

      if (digest !== hmac) {
        console.error("❌ HMAC inválido");
        return res.sendStatus(401);
      }

      const payload = JSON.parse(req.body.toString());

      // 🔎 Buscar tienda
      const shop = await req.db.get(
        `SELECT id FROM shops WHERE shop_domain = ? AND status = 'active'`,
        [shopDomain]
      );

      if (!shop) {
        console.warn("⚠️ Webhook de tienda no registrada:", shopDomain);
        return res.sendStatus(200);
      }

      // =========================
      // ORDERS CREATE / UPDATE
      // =========================
      if (topic === "orders/create" || topic === "orders/updated") {
        const o = payload;

        const customerName = o.customer
          ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
          : "Cliente";

        await req.db.run(
          `
          INSERT INTO orders (
            shop_id,
            order_id,
            order_number,
            created_at,
            customer_name,
            total_price,
            currency,
            fulfillment_status,
            tracking_number,
            carrier,
            raw_json,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(order_id)
          DO UPDATE SET
            fulfillment_status = excluded.fulfillment_status,
            total_price = excluded.total_price,
            currency = excluded.currency,
            raw_json = excluded.raw_json,
            updated_at = datetime('now')
          `,
          [
            shop.id,
            String(o.id),
            o.name,
            o.created_at,
            customerName,
            parseFloat(o.total_price || 0),
            o.currency,
            o.fulfillment_status || "pendiente",
            o.fulfillments?.[0]?.tracking_number || null,
            o.fulfillments?.[0]?.tracking_company || null,
            JSON.stringify(o),
          ]
        );
      }

      // =========================
      // FULFILLMENTS CREATE / UPDATE
      // =========================
      if (
        topic === "fulfillments/create" ||
        topic === "fulfillments/update"
      ) {
        const f = payload;

        if (f.order_id) {
          await req.db.run(
            `
            UPDATE orders
            SET
              tracking_number = ?,
              carrier = ?,
              fulfillment_status = ?,
              updated_at = datetime('now')
            WHERE order_id = ?
            `,
            [
              f.tracking_number || null,
              f.tracking_company || null,
              f.status || "enviado",
              String(f.order_id),
            ]
          );
        }
      }

      console.log("✅ WEBHOOK OK:", topic, shopDomain);
      res.sendStatus(200);
    } catch (e) {
      console.error("❌ Webhook error:", e);
      res.sendStatus(500);
    }
  }
);

module.exports = router;
