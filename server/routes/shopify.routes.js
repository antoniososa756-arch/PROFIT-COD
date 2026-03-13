const auth = require("../middlewares/auth");
const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const router = express.Router();

router.get("/connect", (req, res) => {
  let { shop } = req.query;
  if (!shop) return res.status(400).send("Falta parámetro shop");
  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SHOPIFY_SCOPES}&redirect_uri=${redirectUri}`;
  res.redirect(installUrl);
});

router.get("/callback", async (req, res) => {
  let { shop, hmac, code } = req.query;
  if (!shop || !hmac || !code) return res.status(400).send("Parámetros inválidos");
  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const query = { ...req.query };
  delete query.hmac; delete query.signature;
  const message = Object.keys(query).sort().map(k => `${k}=${query[k]}`).join("&");
  const generatedHmac = crypto.createHmac("sha256", process.env.SHOPIFY_API_SECRET).update(message).digest("hex");
  if (generatedHmac !== hmac) return res.status(401).send("HMAC inválido");
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: process.env.SHOPIFY_API_KEY, client_secret: process.env.SHOPIFY_API_SECRET, code }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).json(tokenData);
    res.redirect("/?shopify=connected");
  } catch (err) {
    res.status(500).send("Error en callback Shopify");
  }
});

router.post("/connect-token", auth, async (req, res) => {
  let { shop, accessToken, appSecret } = req.body;
  const userId = req.user.id;
  if (!shop || !accessToken || !appSecret) return res.status(400).json({ error: "Debes proporcionar dominio, access token y app secret" });

  appSecret = appSecret.trim();
  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  accessToken = accessToken.trim();

  try {
    const response = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (!response.ok) return res.status(401).json({ error: "No autorizado por Shopify" });

    const data = await response.json();
    const myshopifyDomain = data.shop.myshopify_domain.toLowerCase();

    await db.run(
      `INSERT INTO shops (user_id, shop_domain, access_token, app_secret, status, last_sync)
       VALUES (?, ?, ?, ?, 'active', now()::text)
       ON CONFLICT(user_id, shop_domain) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         app_secret = EXCLUDED.app_secret,
         status = 'active',
         last_sync = now()::text`,
      [userId, myshopifyDomain, accessToken, appSecret]
    );

    const webhookUrl = "https://profit-cod.onrender.com/api/shopify/webhooks/orders";
    const topics = ["orders/create", "orders/updated", "fulfillments/create", "fulfillments/update"];
    for (const topic of topics) {
      await fetch(`https://${shop}/admin/api/2024-10/webhooks.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({ webhook: { topic, address: webhookUrl, format: "json" } }),
      });
    }

    res.json({ ok: true, shop: { name: data.shop.name, domain: myshopifyDomain, status: "active", lastSync: new Date().toISOString() } });
  } catch (err) {
    console.error("Shopify connect-token error:", err);
    res.status(500).json({ error: "Error conectando con Shopify" });
  }
});

router.get("/stores", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const rows = await db.all(
      `SELECT id, shop_domain AS domain, shop_name, status, last_sync, created_at FROM shops WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: "Error obteniendo tiendas" }); }
});

router.get("/stores/:id/secret", auth, async (req, res) => {
  try {
    const row = await db.get("SELECT app_secret FROM shops WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (!row) return res.status(404).json({ error: "No encontrada" });
    res.json({ app_secret: row.app_secret });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.patch("/stores/:id/name", auth, async (req, res) => {
  const { shop_name } = req.body;
  try {
    await db.run("UPDATE shops SET shop_name = ? WHERE id = ? AND user_id = ?", [shop_name, req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.post("/disable/:id", auth, async (req, res) => {
  try {
    await db.run("UPDATE shops SET status = 'inactive' WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.post("/rename/:id", auth, async (req, res) => {
  const { name } = req.body;
  try {
    await db.run("UPDATE shops SET shop_name = ? WHERE id = ? AND user_id = ?", [name, req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.get("/secret/:id", auth, async (req, res) => {
  try {
    const row = await db.get("SELECT app_secret FROM shops WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (!row) return res.status(404).json({ error: "No encontrada" });
    res.json({ app_secret: row.app_secret });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.delete("/delete/:id", auth, async (req, res) => {
  try {
    const result = await db.run("DELETE FROM shops WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (!result.changes) return res.status(404).json({ error: "Tienda no encontrada" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error eliminando tienda" }); }
});

function mapSyncStatus(o) {
  if (o.cancelled_at) return "cancelado";
  if (o.financial_status === "refunded") return "devuelto";
  if (o.fulfillment_status === "fulfilled") return "enviado";
  if (o.fulfillment_status === "partial") return "en_preparacion";
  return "pendiente";
}

router.post("/sync-orders", auth, async (req, res) => {
  const userId = req.user.id;
  console.log("🔄 SYNC START user:", userId);
  try {
    const shops = await db.all("SELECT id, shop_domain, access_token FROM shops WHERE user_id = ? AND status = 'active'", [userId]);
    console.log("🏪 SHOPS:", shops.length, shops.map(s => s.shop_domain));
    if (!shops.length) return res.json({ ok: true, synced: 0 });

    let total = 0;
    for (const shop of shops) {
      try {
        console.log("📦 Fetching orders for:", shop.shop_domain);
        const r = await fetch(`https://${shop.shop_domain}/admin/api/2024-10/orders.json?status=any&limit=250`, {
          headers: { "X-Shopify-Access-Token": shop.access_token },
        });
        console.log("📦 Shopify response status:", r.status);
        if (!r.ok) {
          const txt = await r.text();
          console.error("❌ Shopify error:", txt);
          continue;
        }
        const { orders } = await r.json();
        console.log("📦 Orders received:", orders.length);
        for (const o of orders) {
          const customerName = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : "Desconocido";
          await db.run(
            `INSERT INTO orders (shop_id, order_id, order_number, customer_name, fulfillment_status, tracking_number, total_price, currency, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(order_id) DO UPDATE SET
               fulfillment_status = CASE
                 WHEN orders.fulfillment_status IN ('entregado','devuelto','destruido','franquicia','en_transito')
                 THEN orders.fulfillment_status
                 ELSE EXCLUDED.fulfillment_status
               END,
               tracking_number = COALESCE(EXCLUDED.tracking_number, orders.tracking_number)`,
            [shop.id, String(o.id), o.name || String(o.order_number), customerName, mapSyncStatus(o), o.fulfillments?.[0]?.tracking_number || null, o.total_price, o.currency, o.created_at]
          );
          total++;
        }
      } catch (e) { console.error("❌ Sync error for shop", shop.shop_domain, e.message, e.stack); }
    }
    console.log("✅ SYNC DONE, total:", total);
    res.json({ ok: true, synced: total });
  } catch (e) {
    console.error("❌ SYNC GLOBAL ERROR:", e.message, e.stack);
    res.status(500).json({ error: "Error sync" });
  }
});

module.exports = router;