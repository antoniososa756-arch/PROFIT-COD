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

    // Verificar límite de plan (solo para clientes, admin ilimitado)
    const userRow = await db.get("SELECT role, plan FROM users WHERE id = $1", [userId]);
    if (userRow?.role !== "admin") {
      const planLimits = { free: 0, basic: 1, pro: 4, business: 10 };
      const limit = planLimits[userRow?.plan || "free"] ?? 0;
      const existingShops = await db.get(
        "SELECT COUNT(*) as cnt FROM shops WHERE user_id = $1 AND status = 'active' AND shop_domain != $2",
        [userId, shop]
      );
      if (parseInt(existingShops?.cnt || 0) >= limit) {
        return res.redirect("/?shopify=error&msg=plan_limit");
      }
    }

    await db.run(
      `INSERT INTO shops (user_id, shop_domain, shop_name, access_token, app_secret, status, last_sync)
       VALUES ($1, $2, $3, $4, $5, 'active', now()::text)
       ON CONFLICT(user_id, shop_domain) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         app_secret = EXCLUDED.app_secret,
         shop_name = CASE WHEN shops.shop_name IS NULL OR shops.shop_name = '' THEN EXCLUDED.shop_name ELSE shops.shop_name END,
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

    // Importar pedidos históricos en segundo plano al conectar tienda nueva
    const shopRow = await db.get(`SELECT id FROM shops WHERE user_id = $1 AND shop_domain = $2`, [userId, myshopifyDomain]);
    if (shopRow) {
      (async () => {
        try {
          console.log(`Importando pedidos históricos para ${myshopifyDomain}...`);
          let importUrl = `https://${myshopifyDomain}/admin/api/2024-10/orders.json?status=any&limit=250&created_at_min=2026-02-01T00:00:00Z`;
          let importado = 0;
          while (importUrl) {
            const ir = await fetch(importUrl, { headers: { "X-Shopify-Access-Token": accessToken } });
            if (!ir.ok) break;
            const { orders: ords } = await ir.json();
            for (const o of ords) {
              const cn = o.customer ? `${o.customer.first_name||""} ${o.customer.last_name||""}`.trim() : "Desconocido";
              await db.run(
                `INSERT INTO orders (shop_id, order_id, order_number, customer_name, fulfillment_status, financial_status, tracking_number, total_price, currency, created_at, raw_json)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                 ON CONFLICT(order_id) DO NOTHING`,
                [shopRow.id, String(o.id), o.name||String(o.order_number), cn,
                 mapSyncStatus(o), o.financial_status||null,
                 o.fulfillments?.[0]?.tracking_number||null,
                 o.total_price, o.currency, o.created_at, JSON.stringify(o)]
              );
              importado++;
            }
            const lh = ir.headers.get("Link")||"";
            const nm = lh.match(/<([^>]+)>;\s*rel="next"/);
            importUrl = nm ? nm[1] : null;
          }
          console.log(`✅ Importados ${importado} pedidos históricos para ${myshopifyDomain}`);
        } catch(e) {
          console.error(`Error importando históricos ${myshopifyDomain}:`, e.message);
        }
      })();
    }

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
    await db.run("DELETE FROM orders WHERE shop_id = $1", [req.params.id]);
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
        const lastOrder = await db.get(
          `SELECT created_at FROM orders WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [shop.id]
        );
        const since = lastOrder?.created_at
          ? new Date(new Date(lastOrder.created_at).getTime() - 60 * 60 * 1000).toISOString()
          : "2026-02-01T00:00:00Z";
        let url = `https://${shop.shop_domain}/admin/api/2024-10/orders.json?status=any&limit=250&created_at_min=${since}`;

        while (url) {
          const r = await fetch(url, {
            headers: { "X-Shopify-Access-Token": shop.access_token },
          });
          if (!r.ok) break;

          const { orders } = await r.json();

          for (const o of orders) {
            const customerName = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : "Desconocido";
            await db.run(
              `INSERT INTO orders (shop_id, shop_domain, order_id, order_number, customer_name, fulfillment_status, financial_status, tracking_number, total_price, currency, created_at, cancelled_at, raw_json)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT(order_id) DO UPDATE SET
                 shop_id = EXCLUDED.shop_id,
                 shop_domain = EXCLUDED.shop_domain,
                 fulfillment_status = CASE
                   WHEN orders.tracking_number IS NOT NULL
                   THEN orders.fulfillment_status
                   ELSE EXCLUDED.fulfillment_status
                 END,
                 financial_status = EXCLUDED.financial_status,
                 tracking_number = COALESCE(EXCLUDED.tracking_number, orders.tracking_number),
                 cancelled_at = EXCLUDED.cancelled_at,
                 raw_json = EXCLUDED.raw_json`,
              [shop.id, shop.shop_domain, String(o.id), o.name || String(o.order_number), customerName, mapSyncStatus(o), o.financial_status || null, o.fulfillments?.[0]?.tracking_number || null, o.total_price, o.currency, o.created_at, o.cancelled_at || null, JSON.stringify(o)]
            );
            total++;
          }

          const linkHeader = r.headers.get("Link") || "";
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          url = nextMatch ? nextMatch[1] : null;
        }

        await db.run("UPDATE shops SET last_sync = now()::text WHERE id = $1", [shop.id]);
      } catch (e) { console.error("Sync error for shop", shop.shop_domain, e.message); }
    }
    console.log(`Sync completado: ${total} pedidos`);
    res.json({ ok: true, synced: total });
  } catch (e) {
    console.error("Error sync:", e.message);
    res.json({ ok: false, error: e.message });
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
    // stock efectivo = base + movimientos; si el producto está en un grupo se agregan todos los miembros
    const rows = await db.all(
      `WITH
       -- Neto de movimientos por grupo
       group_mov AS (
         SELECT pgm.group_id,
           SUM(CASE WHEN sm.movement_type='salida' THEN -sm.units ELSE sm.units END) AS net
         FROM product_group_members pgm
         JOIN stock_movements sm ON sm.product_id = pgm.product_id AND sm.user_id = pgm.user_id
         WHERE pgm.user_id = $1
         GROUP BY pgm.group_id
       ),
       -- Base de stock por grupo (suma de todos los miembros)
       group_base AS (
         SELECT pgm.group_id,
           SUM(COALESCE(ps.stock, 0)) AS base
         FROM product_group_members pgm
         LEFT JOIN productos_stock ps ON ps.product_id = pgm.product_id AND ps.user_id = pgm.user_id
         WHERE pgm.user_id = $1
         GROUP BY pgm.group_id
       ),
       -- Movimientos individuales (no agrupados)
       indiv_mov AS (
         SELECT sm.product_id,
           SUM(CASE WHEN sm.movement_type='salida' THEN -sm.units ELSE sm.units END) AS net
         FROM stock_movements sm
         WHERE sm.user_id = $1
           AND sm.product_id NOT IN (SELECT product_id FROM product_group_members WHERE user_id = $1)
         GROUP BY sm.product_id
       )
       -- Productos en grupo
       SELECT ps.shop_domain, ps.product_id, ps.stock_minimo, ps.costo_compra,
              COALESCE(gb.base,0) + COALESCE(gm.net,0) AS stock,
              pgm.group_id, pg.name AS group_name
       FROM productos_stock ps
       JOIN product_group_members pgm ON pgm.product_id = ps.product_id AND pgm.user_id = $1
       JOIN product_groups pg ON pg.id = pgm.group_id
       LEFT JOIN group_base gb ON gb.group_id = pgm.group_id
       LEFT JOIN group_mov gm ON gm.group_id = pgm.group_id
       WHERE ps.user_id = $1

       UNION ALL

       -- Productos sin grupo, con fila en productos_stock
       SELECT ps.shop_domain, ps.product_id, ps.stock_minimo, ps.costo_compra,
              COALESCE(ps.stock,0) + COALESCE(im.net,0) AS stock,
              NULL AS group_id, NULL AS group_name
       FROM productos_stock ps
       LEFT JOIN indiv_mov im ON im.product_id = ps.product_id
       WHERE ps.user_id = $1
         AND ps.product_id NOT IN (SELECT product_id FROM product_group_members WHERE user_id = $1)

       UNION ALL

       -- Productos solo en movimientos (sin productos_stock, sin grupo)
       SELECT sm.shop_domain, sm.product_id, 5, 0,
              SUM(CASE WHEN sm.movement_type='salida' THEN -sm.units ELSE sm.units END) AS stock,
              NULL, NULL
       FROM stock_movements sm
       WHERE sm.user_id = $1
         AND sm.product_id NOT IN (SELECT product_id FROM productos_stock WHERE user_id = $1)
         AND sm.product_id NOT IN (SELECT product_id FROM product_group_members WHERE user_id = $1)
       GROUP BY sm.shop_domain, sm.product_id`,
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

// POST /api/shopify/sync-stock-movements
// Processes orders and logs stock movements (salida/devolucion), adjusting stock for new ones.
// from: YYYY-MM-DD, defaults to first day of current month
router.post("/sync-stock-movements", auth, async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
  const from = req.body.from || defaultFrom;

  const SHIPPED = ['enviado','en_transito','entregado','franquicia','en_preparacion','destruido','devuelto'];

  try {
    // Build variant → uds_por_venta map
    const varRows = await db.all(
      "SELECT variant_id, unidades_por_venta FROM productos_variantes_config WHERE user_id = $1",
      [userId]
    );
    const varMap = {};
    varRows.forEach(v => { varMap[String(v.variant_id)] = parseInt(v.unidades_por_venta) || 1; });

    // Get unprocessed orders (not yet in stock_movements) in shipped/returned states
    const orders = await db.all(
      `SELECT o.order_id, o.order_number, o.fulfillment_status,
              (o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date AS movement_date,
              COALESCE(o.shop_domain, s.shop_domain) AS shop_domain,
              o.raw_json
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1)
         AND o.fulfillment_status = ANY($2::text[])
         AND o.raw_json IS NOT NULL
         AND (o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date >= $3::date
         AND NOT EXISTS (
           SELECT 1 FROM stock_movements sm
           WHERE sm.user_id = $1 AND sm.order_id = o.order_id
             AND sm.movement_type = CASE WHEN o.fulfillment_status = 'devuelto' THEN 'devolucion' ELSE 'salida' END
         )`,
      [userId, SHIPPED, from]
    );

    let applied = 0;
    for (const order of orders) {
      let raw;
      try { raw = typeof order.raw_json === "string" ? JSON.parse(order.raw_json) : order.raw_json; } catch { continue; }
      if (!Array.isArray(raw?.line_items) || raw.line_items.length === 0) continue;

      const isDevuelto = order.fulfillment_status === "devuelto";
      // salida for all shipped (including devuelto which was physically sent)
      // devolucion only for devuelto
      const typesToProcess = isDevuelto ? ["salida", "devolucion"] : ["salida"];

      // Group units by product
      const productUnits = {};
      for (const item of raw.line_items) {
        const pid = String(item.product_id || "");
        const vid = String(item.variant_id || "");
        if (!pid || pid === "null") continue;
        const uds = varMap[vid] || 1;
        const qty = parseInt(item.quantity) || 1;
        productUnits[pid] = (productUnits[pid] || 0) + uds * qty;
      }

      for (const [pid, units] of Object.entries(productUnits)) {
        for (const movType of typesToProcess) {
          const r = await db.run(
            `INSERT INTO stock_movements (user_id, shop_domain, product_id, order_id, order_number, movement_type, units, movement_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT(user_id, order_id, product_id, movement_type) DO NOTHING`,
            [userId, order.shop_domain || "", pid, order.order_id, order.order_number, movType, units, order.movement_date]
          );
          if (r.changes > 0) {
            applied++;
          }
        }
      }
    }

    res.json({ ok: true, applied });
  } catch(e) { console.error("sync-stock-movements error:", e); res.status(500).json({ error: "Error sincronizando movimientos" }); }
});

// GET /api/shopify/stock-history?product_id=X  OR  ?group_id=Y
router.get("/stock-history", auth, async (req, res) => {
  const userId = req.user.id;
  const { product_id, group_id } = req.query;
  if (!product_id && !group_id) return res.status(400).json({ error: "Falta product_id o group_id" });
  try {
    let rows;
    if (group_id) {
      rows = await db.all(
        `SELECT
           fecha,
           COALESCE(SUM(pedidos_enviados),0)  AS pedidos_enviados,
           COALESCE(SUM(uds_salida),0)         AS uds_salida,
           COALESCE(SUM(pedidos_devueltos),0)  AS pedidos_devueltos,
           COALESCE(SUM(uds_devolucion),0)     AS uds_devolucion,
           COALESCE(SUM(uds_entrada),0)        AS uds_entrada
         FROM (
           -- Movimientos de pedidos (salidas y devoluciones)
           SELECT
             TO_CHAR(sm.movement_date, 'YYYY-MM-DD') AS fecha,
             COUNT(*) FILTER (WHERE sm.movement_type = 'salida')     AS pedidos_enviados,
             COALESCE(SUM(sm.units) FILTER (WHERE sm.movement_type = 'salida'), 0)     AS uds_salida,
             COUNT(*) FILTER (WHERE sm.movement_type = 'devolucion') AS pedidos_devueltos,
             COALESCE(SUM(sm.units) FILTER (WHERE sm.movement_type = 'devolucion'), 0) AS uds_devolucion,
             0 AS uds_entrada
           FROM stock_movements sm
           JOIN product_group_members pgm ON pgm.product_id = sm.product_id AND pgm.user_id = sm.user_id
           WHERE sm.user_id = $1 AND pgm.group_id = $2
           GROUP BY sm.movement_date
           UNION ALL
           -- Entradas de mercancía
           SELECT
             TO_CHAR(em.created_at::timestamptz AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD') AS fecha,
             0, 0, 0, 0,
             SUM(em.cantidad) AS uds_entrada
           FROM entradas_mercancia em
           JOIN product_group_members pgm ON pgm.product_id = em.product_id AND pgm.user_id = em.user_id
           WHERE em.user_id = $1 AND pgm.group_id = $2
           GROUP BY TO_CHAR(em.created_at::timestamptz AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD')
         ) combined
         GROUP BY fecha
         ORDER BY fecha DESC
         LIMIT 90`,
        [userId, parseInt(group_id)]
      );
    } else {
      rows = await db.all(
        `SELECT
           fecha,
           COALESCE(SUM(pedidos_enviados),0)  AS pedidos_enviados,
           COALESCE(SUM(uds_salida),0)         AS uds_salida,
           COALESCE(SUM(pedidos_devueltos),0)  AS pedidos_devueltos,
           COALESCE(SUM(uds_devolucion),0)     AS uds_devolucion,
           COALESCE(SUM(uds_entrada),0)        AS uds_entrada
         FROM (
           -- Movimientos de pedidos
           SELECT
             TO_CHAR(movement_date, 'YYYY-MM-DD') AS fecha,
             COUNT(*) FILTER (WHERE movement_type = 'salida')     AS pedidos_enviados,
             COALESCE(SUM(units) FILTER (WHERE movement_type = 'salida'), 0)     AS uds_salida,
             COUNT(*) FILTER (WHERE movement_type = 'devolucion') AS pedidos_devueltos,
             COALESCE(SUM(units) FILTER (WHERE movement_type = 'devolucion'), 0) AS uds_devolucion,
             0 AS uds_entrada
           FROM stock_movements
           WHERE user_id = $1 AND product_id = $2
           GROUP BY movement_date
           UNION ALL
           -- Entradas de mercancía
           SELECT
             TO_CHAR(created_at::timestamptz AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD') AS fecha,
             0, 0, 0, 0,
             SUM(cantidad) AS uds_entrada
           FROM entradas_mercancia
           WHERE user_id = $1 AND product_id = $2
           GROUP BY TO_CHAR(created_at::timestamptz AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD')
         ) combined
         GROUP BY fecha
         ORDER BY fecha DESC
         LIMIT 90`,
        [userId, product_id]
      );
    }
    res.json(rows || []);
  } catch(e) { console.error("stock-history:", e.message); res.status(500).json({ error: "Error historial" }); }
});

// ── Product Groups (stock compartido) ────────────────────────────────────────

// GET /api/shopify/product-groups
router.get("/product-groups", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const groups = await db.all(
      `SELECT pg.id, pg.name,
              json_agg(json_build_object('product_id', pgm.product_id, 'shop_domain', pgm.shop_domain) ORDER BY pgm.product_id) AS members
       FROM product_groups pg
       LEFT JOIN product_group_members pgm ON pgm.group_id = pg.id
       WHERE pg.user_id = $1
       GROUP BY pg.id, pg.name
       ORDER BY pg.name`,
      [userId]
    );
    // json_agg returns [null] when no members — clean that up
    const clean = groups.map(g => ({
      ...g,
      members: (g.members || []).filter(m => m && m.product_id),
    }));
    res.json(clean);
  } catch(e) { console.error("product-groups GET:", e); res.status(500).json({ error: "Error" }); }
});

// POST /api/shopify/product-groups  { name }
router.post("/product-groups", auth, async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Falta nombre" });
  try {
    const row = await db.get(
      `INSERT INTO product_groups (user_id, name) VALUES ($1, $2)
       ON CONFLICT(user_id, name) DO UPDATE SET name=EXCLUDED.name
       RETURNING id, name`,
      [userId, name.trim()]
    );
    res.json(row);
  } catch(e) { console.error("product-groups POST:", e); res.status(500).json({ error: "Error creando grupo" }); }
});

// POST /api/shopify/product-groups/:id/members  { product_id, shop_domain }
router.post("/product-groups/:id/members", auth, async (req, res) => {
  const userId = req.user.id;
  const groupId = parseInt(req.params.id);
  const { product_id, shop_domain } = req.body;
  if (!product_id || !shop_domain) return res.status(400).json({ error: "Faltan datos" });
  try {
    // Verify group belongs to user
    const grp = await db.get("SELECT id FROM product_groups WHERE id=$1 AND user_id=$2", [groupId, userId]);
    if (!grp) return res.status(404).json({ error: "Grupo no encontrado" });

    await db.run(
      `INSERT INTO product_group_members (group_id, user_id, product_id, shop_domain)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(user_id, product_id) DO UPDATE SET group_id=EXCLUDED.group_id, shop_domain=EXCLUDED.shop_domain`,
      [groupId, userId, product_id, shop_domain]
    );
    res.json({ ok: true });
  } catch(e) { console.error("product-groups members POST:", e); res.status(500).json({ error: "Error añadiendo miembro" }); }
});

// DELETE /api/shopify/product-groups/:id/members/:productId
router.delete("/product-groups/:id/members/:productId", auth, async (req, res) => {
  const userId = req.user.id;
  const groupId = parseInt(req.params.id);
  const productId = req.params.productId;
  try {
    await db.run(
      `DELETE FROM product_group_members WHERE group_id=$1 AND user_id=$2 AND product_id=$3`,
      [groupId, userId, productId]
    );
    // If group is now empty, delete it
    const count = await db.get(
      `SELECT COUNT(*) AS c FROM product_group_members WHERE group_id=$1`,
      [groupId]
    );
    if (parseInt(count?.c || 0) === 0) {
      await db.run("DELETE FROM product_groups WHERE id=$1 AND user_id=$2", [groupId, userId]);
    }
    res.json({ ok: true });
  } catch(e) { console.error("product-groups members DELETE:", e); res.status(500).json({ error: "Error eliminando miembro" }); }
});

// DELETE /api/shopify/product-groups/:id  (delete entire group)
router.delete("/product-groups/:id", auth, async (req, res) => {
  const userId = req.user.id;
  const groupId = parseInt(req.params.id);
  try {
    await db.run("DELETE FROM product_groups WHERE id=$1 AND user_id=$2", [groupId, userId]);
    res.json({ ok: true });
  } catch(e) { console.error("product-groups DELETE:", e); res.status(500).json({ error: "Error eliminando grupo" }); }
});

// ─────────────────────────────────────────────────────────────────────────────

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

// ── Sync de recuperación: día 1 de cada mes revisa el mes anterior completo ──
async function syncRecuperacion() {
  const now = new Date();
  if (now.getDate() !== 1) return; // Solo ejecutar el día 1

  const primerDiaMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const primerDiaMesActual   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  console.log(`🔄 Sync recuperación: revisando ${primerDiaMesAnterior.slice(0,7)}`);

  try {
    const shops = await db.all(`SELECT id, shop_domain, access_token FROM shops WHERE status = 'active'`);

    for (const shop of shops) {
      try {
        let url = `https://${shop.shop_domain}/admin/api/2024-10/orders.json?status=any&limit=250&created_at_min=${primerDiaMesAnterior}&created_at_max=${primerDiaMesActual}`;

        while (url) {
          const r = await fetch(url, { headers: { "X-Shopify-Access-Token": shop.access_token } });
          if (!r.ok) break;

          const { orders } = await r.json();
          for (const o of orders) {
            const customerName = o.customer
              ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
              : "Desconocido";
            await db.run(
              `INSERT INTO orders (shop_id, order_id, order_number, customer_name, fulfillment_status, financial_status, tracking_number, total_price, currency, created_at, raw_json)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT(order_id) DO NOTHING`,
              [shop.id, String(o.id), o.name || String(o.order_number), customerName,
               mapSyncStatus(o), o.financial_status || null,
               o.fulfillments?.[0]?.tracking_number || null,
               o.total_price, o.currency, o.created_at, JSON.stringify(o)]
            );
          }

          const linkHeader = r.headers.get("Link") || "";
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          url = nextMatch ? nextMatch[1] : null;
        }
      } catch(e) {
        console.error(`Recuperación error shop ${shop.shop_domain}:`, e.message);
      }
    }
    console.log(`✅ Sync recuperación completado`);
  } catch(e) {
    console.error("Sync recuperación error:", e.message);
  }
}

router.post("/sync-cancelados", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const shops = await db.all("SELECT id, shop_domain, access_token FROM shops WHERE user_id = $1 AND status = 'active'", [userId]);
    if (!shops.length) return res.json({ ok: true, updated: 0 });

    res.json({ ok: true, msg: "Sincronización de cancelados iniciada en segundo plano" });

    let total = 0;
    for (const shop of shops) {
      try {
        let url = `https://${shop.shop_domain}/admin/api/2024-10/orders.json?status=cancelled&limit=250&created_at_min=2026-02-01T00:00:00Z`;
        while (url) {
          const r = await fetch(url, {
            headers: { "X-Shopify-Access-Token": shop.access_token },
          });
          if (!r.ok) break;
          const { orders } = await r.json();
          for (const o of orders) {
            const exists = await db.get("SELECT id FROM orders WHERE order_id = $1", [String(o.id)]);
            if (exists) {
              await db.run(
                `UPDATE orders SET raw_json = $1, fulfillment_status = 'cancelado', updated_at = now()::text WHERE order_id = $2`,
                [JSON.stringify(o), String(o.id)]
              );
              total++;
            }
          }
          const linkHeader = r.headers.get("Link") || "";
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          url = nextMatch ? nextMatch[1] : null;
        }
      } catch(e) { console.error("Sync cancelados error:", shop.shop_domain, e.message); }
    }
    console.log(`Sync cancelados completado: ${total} pedidos actualizados`);
  } catch(e) {
    console.error("Error sync cancelados:", e.message);
  }
});

// Ejecutar cada 24 horas, el día 1 se activa solo
setInterval(syncRecuperacion, 24 * 60 * 60 * 1000);
// También ejecutar al arrancar el servidor (por si reinició el día 1)
syncRecuperacion();

module.exports = router;