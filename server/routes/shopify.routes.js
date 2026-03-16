const auth = require("../middlewares/auth");
const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const router = express.Router();

router.get("/connect", async (req, res) => {
  let { shop, token } = req.query;
  if (!shop || !token) return res.status(400).send("Faltan parámetros");

  const jwt = require("jsonwebtoken");
  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch(e) {
    return res.status(401).send("Token inválido");
  }

  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  if (!shop.includes(".myshopify.com")) shop = shop + ".myshopify.com";

  const state = Buffer.from(JSON.stringify({ userId: user.id, shop })).toString("base64");
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SHOPIFY_SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  res.redirect(installUrl);
});

router.get("/callback", async (req, res) => {
  let { shop, hmac, code, state } = req.query;
  if (!shop || !hmac || !code || !state) return res.redirect("/?shopify=error&msg=params");

  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();

  const query = { ...req.query };
  delete query.hmac; delete query.signature;
  const message = Object.keys(query).sort().map(k => `${k}=${query[k]}`).join("&");
  const generatedHmac = crypto.createHmac("sha256", process.env.SHOPIFY_API_SECRET).update(message).digest("hex");
  if (generatedHmac !== hmac) return res.redirect("/?shopify=error&msg=hmac");

  let userId;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
    userId = decoded.userId;
  } catch(e) {
    return res.redirect("/?shopify=error&msg=state");
  }

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: process.env.SHOPIFY_API_KEY, client_secret: process.env.SHOPIFY_API_SECRET, code }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect("/?shopify=error&msg=token");

    const accessToken = tokenData.access_token;
    const appSecret = process.env.SHOPIFY_API_SECRET;

    const shopRes = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken }
    });
    const shopData = await shopRes.json();
    const shopName = shopData.shop?.name || shop;

    await db.run(
      `INSERT INTO shops (user_id, shop_domain, shop_name, access_token, app_secret, status, last_sync)
       VALUES ($1, $2, $3, $4, $5, 'active', now()::text)
       ON CONFLICT(user_id, shop_domain) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         app_secret = EXCLUDED.app_secret,
         shop_name = EXCLUDED.shop_name,
         status = 'active',
         last_sync = now()::text`,
      [userId, shop, shopName, accessToken, appSecret]
    );

    const webhookUrl = `${process.env.APP_URL}/api/shopify/webhooks/orders`;
    const topics = ["orders/create", "orders/updated", "fulfillments/create", "fulfillments/update"];
    for (const topic of topics) {
      await fetch(`https://${shop}/admin/api/2024-10/webhooks.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({ webhook: { topic, address: webhookUrl, format: "json" } }),
      }).catch(() => {});
    }

    res.redirect("/?shopify=connected");
  } catch (err) {
    console.error("Shopify callback error:", err);
    res.redirect("/?shopify=error&msg=server");
  }
});

router.post("/connect-token", auth, async (req, res) => {
  let { shop, accessToken, appSecret } = req.body;
  const userId = req.user.id;
  if (!shop || !accessToken) return res.status(400).json({ error: "Debes proporcionar dominio y access token" });
if (!appSecret) appSecret = process.env.SHOPIFY_API_SECRET || "";

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
       VALUES ($1, $2, $3, $4, 'active', now()::text)
       ON CONFLICT(user_id, shop_domain) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         app_secret = EXCLUDED.app_secret,
         status = 'active',
         last_sync = now()::text`,
      [userId, myshopifyDomain, accessToken, appSecret]
    );

    const webhookUrl = `${process.env.APP_URL}/api/shopify/webhooks/orders`;
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
      `SELECT id, shop_domain AS domain, shop_name, status, last_sync, created_at FROM shops WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: "Error obteniendo tiendas" }); }
});

router.get("/stores/:id/secret", auth, async (req, res) => {
  try {
    const row = await db.get("SELECT app_secret FROM shops WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    if (!row) return res.status(404).json({ error: "No encontrada" });
    res.json({ app_secret: row.app_secret });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.patch("/stores/:id/name", auth, async (req, res) => {
  const { shop_name } = req.body;
  try {
    await db.run("UPDATE shops SET shop_name = $1 WHERE id = $2 AND user_id = $3", [shop_name, req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.post("/disable/:id", auth, async (req, res) => {
  try {
    await db.run("UPDATE shops SET status = 'inactive' WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.post("/rename/:id", auth, async (req, res) => {
  const { name } = req.body;
  try {
    await db.run("UPDATE shops SET shop_name = $1 WHERE id = $2 AND user_id = $3", [name, req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.get("/secret/:id", auth, async (req, res) => {
  try {
    const row = await db.get("SELECT app_secret FROM shops WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    if (!row) return res.status(404).json({ error: "No encontrada" });
    res.json({ app_secret: row.app_secret });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.delete("/delete/:id", auth, async (req, res) => {
  try {
    const result = await db.run("DELETE FROM shops WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Tienda no encontrada" });
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
  try {
    const shops = await db.all("SELECT id, shop_domain, access_token FROM shops WHERE user_id = $1 AND status = 'active'", [userId]);
    if (!shops.length) return res.json({ ok: true, synced: 0 });

    let total = 0;
    for (const shop of shops) {
      try {
        let url = `https://${shop.shop_domain}/admin/api/2024-10/orders.json?status=any&limit=250&created_at_min=2026-02-01T00:00:00Z`;

        while (url) {
          const r = await fetch(url, {
            headers: { "X-Shopify-Access-Token": shop.access_token },
          });
          if (!r.ok) break;

          const { orders } = await r.json();

          for (const o of orders) {
            const customerName = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : "Desconocido";
            await db.run(
              `INSERT INTO orders (shop_id, order_id, order_number, customer_name, fulfillment_status, financial_status, tracking_number, total_price, currency, created_at, raw_json)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT(order_id) DO UPDATE SET
                 fulfillment_status = CASE
                   WHEN orders.tracking_number IS NOT NULL
                   THEN orders.fulfillment_status
                   ELSE EXCLUDED.fulfillment_status
                 END,
                 financial_status = EXCLUDED.financial_status,
                 tracking_number = COALESCE(EXCLUDED.tracking_number, orders.tracking_number),
                 raw_json = EXCLUDED.raw_json`,
              [shop.id, String(o.id), o.name || String(o.order_number), customerName, mapSyncStatus(o), o.financial_status || null, o.fulfillments?.[0]?.tracking_number || null, o.total_price, o.currency, o.created_at, JSON.stringify(o)]
            );
            total++;
          }

          const linkHeader = r.headers.get("Link") || "";
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          url = nextMatch ? nextMatch[1] : null;
        }

      } catch (e) { console.error("Sync error for shop", shop.shop_domain, e.message); }
    }
    res.json({ ok: true, synced: total });
  } catch (e) {
    res.status(500).json({ error: "Error sync" });
  }
});

router.get("/products", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const shops = await db.all(
      "SELECT id, shop_domain, shop_name, access_token FROM shops WHERE user_id = $1 AND status = 'active'",
      [userId]
    );
    if (!shops.length) return res.json([]);

    const result = [];
    for (const shop of shops) {
      try {
        const r = await fetch(
          `https://${shop.shop_domain}/admin/api/2024-10/products.json?limit=250`,
          { headers: { "X-Shopify-Access-Token": shop.access_token } }
        );
        if (!r.ok) { console.error("Shopify products error:", shop.shop_domain, r.status); continue; }
        const json = await r.json();
        const allProducts = json.products || [];
        const activeProducts = allProducts.filter(p => p.status === "active");
        result.push({
          shop_domain: shop.shop_domain,
          shop_name: shop.shop_name || shop.shop_domain,
          products: activeProducts.map(p => ({
            id: p.id,
            title: p.title,
            image: p.image?.src || null,
            variants: (p.variants || []).map(v => ({
              id: v.id,
              title: v.title,
              sku: v.sku || "-",
              price: v.price
            }))
          }))
        });
      } catch(e) { console.error("Products error:", shop.shop_domain, e.message); }
    }
    res.json(result);
  } catch(e) { res.status(500).json({ error: "Error obteniendo productos" }); }
});

router.get("/stock", auth, async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT shop_domain, product_id, stock, stock_minimo, costo_compra FROM productos_stock WHERE user_id = $1",
      [req.user.id]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: "Error stock" }); }
});

router.post("/stock", auth, async (req, res) => {
  const { shop_domain, product_id, stock, stock_minimo, costo_compra } = req.body;
  try {
    await db.run(
      `INSERT INTO productos_stock (user_id, shop_domain, product_id, stock, stock_minimo, costo_compra)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(user_id, shop_domain, product_id) DO UPDATE SET
         stock = COALESCE(EXCLUDED.stock, productos_stock.stock),
         stock_minimo = COALESCE(EXCLUDED.stock_minimo, productos_stock.stock_minimo),
         costo_compra = COALESCE(EXCLUDED.costo_compra, productos_stock.costo_compra)`,
      [req.user.id, shop_domain, product_id, stock ?? null, stock_minimo ?? null, costo_compra ?? null]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: "Error guardando stock" }); }
});

router.get("/variantes-config", auth, async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT shop_domain, variant_id, unidades_por_venta FROM productos_variantes_config WHERE user_id = $1",
      [req.user.id]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

router.post("/variantes-config", auth, async (req, res) => {
  const { shop_domain, variant_id, unidades_por_venta } = req.body;
  try {
    await db.run(
      `INSERT INTO productos_variantes_config (user_id, shop_domain, variant_id, unidades_por_venta)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(user_id, shop_domain, variant_id) DO UPDATE SET unidades_por_venta = EXCLUDED.unidades_por_venta`,
      [req.user.id, shop_domain, variant_id, parseInt(unidades_por_venta)||1]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

router.post("/entrada-mercancia", auth, async (req, res) => {
  const { shop_domain, product_id, product_name, cantidad, stock_anterior } = req.body;
  const stock_nuevo = (parseInt(stock_anterior)||0) + (parseInt(cantidad)||0);
  try {
    await db.run(
      `INSERT INTO entradas_mercancia (user_id, shop_domain, product_id, product_name, cantidad, stock_anterior, stock_nuevo, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now()::text)`,
      [req.user.id, shop_domain, product_id, product_name, parseInt(cantidad)||0, parseInt(stock_anterior)||0, stock_nuevo]
    );
    await db.run(
      `INSERT INTO productos_stock (user_id, shop_domain, product_id, stock, stock_minimo)
       VALUES ($1, $2, $3, $4, 5)
       ON CONFLICT(user_id, shop_domain, product_id) DO UPDATE SET stock = EXCLUDED.stock`,
      [req.user.id, shop_domain, product_id, stock_nuevo]
    );
    res.json({ ok: true, stock_nuevo });
  } catch(e) { res.status(500).json({ error: "Error guardando entrada" }); }
});

router.get("/entradas-mercancia", auth, async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT * FROM entradas_mercancia WHERE user_id = $1 ORDER BY id DESC LIMIT 100",
      [req.user.id]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

router.get("/informes-ingresos", auth, async (req, res) => {
  const { mes } = req.query;
  try {
    const rows = await db.all(
      "SELECT shop_domain, columna, nombre, valor FROM informes_ingresos_manuales WHERE user_id = $1 AND mes = $2",
      [req.user.id, mes]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

router.post("/informes-ingresos", auth, async (req, res) => {
  const { shop_domain, mes, columna, nombre, valor } = req.body;
  try {
    await db.run(
      `INSERT INTO informes_ingresos_manuales (user_id, shop_domain, mes, columna, nombre, valor)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(user_id, shop_domain, mes, columna) DO UPDATE SET nombre=EXCLUDED.nombre, valor=EXCLUDED.valor`,
      [req.user.id, shop_domain, mes, columna, nombre || '', parseFloat(valor)||0]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

router.get("/precios-globales", auth, async (req, res) => {
  try {
    const row = await db.get("SELECT * FROM gastos_fijos_precios_globales WHERE user_id = $1", [req.user.id]);
    res.json(row || { precio_mrw: 0, precio_logistica: 0 });
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

router.post("/precios-globales", auth, async (req, res) => {
  const { precio_mrw, precio_logistica } = req.body;
  try {
    await db.run(
      `INSERT INTO gastos_fijos_precios_globales (user_id, precio_mrw, precio_logistica)
       VALUES ($1, $2, $3)
       ON CONFLICT(user_id) DO UPDATE SET precio_mrw=EXCLUDED.precio_mrw, precio_logistica=EXCLUDED.precio_logistica`,
      [req.user.id, parseFloat(precio_mrw)||0, parseFloat(precio_logistica)||0]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

module.exports = router;