const auth = require("../middlewares/auth");
const express = require("express");
const crypto = require("crypto");

const router = express.Router();

/* =====================================================
   OAUTH → INICIAR CONEXIÓN
   ===================================================== */
router.get("/connect", (req, res) => {
  let { shop } = req.query;

  if (!shop) {
    return res.status(400).send("Falta parámetro shop");
  }

  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${process.env.SHOPIFY_SCOPES}` +
    `&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

/* =====================================================
   OAUTH → CALLBACK SHOPIFY
   ===================================================== */
router.get("/callback", async (req, res) => {
  let { shop, hmac, code } = req.query;

  if (!shop || !hmac || !code) {
    return res.status(400).send("Parámetros inválidos");
  }

  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const query = { ...req.query };
  delete query.hmac;
  delete query.signature;

  const message = Object.keys(query)
    .sort()
    .map(k => `${k}=${query[k]}`)
    .join("&");

  const generatedHmac = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");

  if (generatedHmac !== hmac) {
    return res.status(401).send("HMAC inválido");
  }

  try {
    const tokenRes = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(400).json(tokenData);
    }

    console.log("✅ Shopify OAuth OK:", shop);
    res.redirect("/?shopify=connected");

  } catch (err) {
    console.error("Shopify callback error:", err);
    res.status(500).send("Error en callback Shopify");
  }
});

/* =====================================================
   CONEXIÓN REAL CON TOKEN
   POST /api/shopify/connect-token
   ===================================================== */
router.post("/connect-token", auth, async (req, res) => {
  console.log("🚀 CONNECT-TOKEN LLAMADO", req.body);

  let { shop, accessToken, appSecret } = req.body;
  const userId = req.user.id;

  if (!shop || !accessToken || !appSecret) {
    return res.status(400).json({
      error: "Debes proporcionar dominio, access token y app secret",
    });
  }

  appSecret = appSecret.trim();
  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  accessToken = accessToken.trim();

  try {
    // 1️⃣ Validar token y obtener info de la tienda
    const response = await fetch(
      `https://${shop}/admin/api/2024-10/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Shopify auth error:", text);
      return res.status(401).json({ error: "No autorizado por Shopify" });
    }

    const data = await response.json();

    // 2️⃣ Obtener dominio interno myshopify (el que usan los webhooks)
    const myshopifyDomain = data.shop.myshopify_domain.toLowerCase();
    console.log("🏪 Dominio interno Shopify:", myshopifyDomain);

    // 3️⃣ Guardar tienda con dominio interno
    await req.db.run(
      `INSERT INTO shops (
        user_id, shop_domain, access_token, app_secret, status, last_sync
      ) VALUES (?, ?, ?, ?, 'active', datetime('now'))
      ON CONFLICT(user_id, shop_domain)
      DO UPDATE SET
        access_token = excluded.access_token,
        app_secret = excluded.app_secret,
        status = 'active',
        last_sync = datetime('now')`,
      [userId, myshopifyDomain, accessToken, appSecret]
    );

    // 4️⃣ Registrar webhooks
    const webhookUrl = "https://profit-cod.onrender.com/api/shopify/webhooks/orders";
    const topics = [
      "orders/create",
      "orders/updated",
      "fulfillments/create",
      "fulfillments/update",
    ];

    for (const topic of topics) {
      await fetch(`https://${shop}/admin/api/2024-10/webhooks.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          webhook: { topic, address: webhookUrl, format: "json" },
        }),
      });
    }

    // 5️⃣ Respuesta final
    res.json({
      ok: true,
      shop: {
        name: data.shop.name,
        domain: myshopifyDomain,
        status: "active",
        lastSync: new Date().toISOString(),
      },
    });

  } catch (err) {
    console.error("Shopify connect-token error:", err);
    res.status(500).json({ error: "Error conectando con Shopify" });
  }
});

/* =====================================================
   LISTAR TIENDAS CONECTADAS
   ===================================================== */
router.get("/stores", auth, async (req, res) => {
  const userId = req.user.id;

  req.db.all(
    `SELECT id, shop_domain AS domain, shop_name, status, last_sync, created_at
     FROM shops
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error("DB shops error:", err);
        return res.status(500).json({ error: "Error base de datos" });
      }
      res.json(rows || []);
    }
  );
});

/* =====================================================
   DESHABILITAR TIENDA
   POST /api/shopify/disable/:id
   ===================================================== */
router.post("/disable/:id", auth, async (req, res) => {
  const shopId = req.params.id;
  const userId = req.user.id;

  try {
    const result = await req.db.run(
      `UPDATE shops SET status = 'disabled' WHERE id = ? AND user_id = ?`,
      [shopId, userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Tienda no encontrada" });
    }

    res.json({ ok: true });

  } catch (err) {
    console.error("Disable shop error:", err);
    res.status(500).json({ error: "Error deshabilitando tienda" });
  }
});

/* =====================================================
   ACTUALIZAR NOMBRE DE TIENDA
   POST /api/shopify/rename/:id
   ===================================================== */
router.post("/rename/:id", auth, (req, res) => {
  const shopId = req.params.id;
  const userId = req.user.id;
  let { name } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Nombre inválido" });
  }

  name = name.trim().slice(0, 10);

  req.db.run(
    `UPDATE shops SET shop_name = ? WHERE id = ? AND user_id = ?`,
    [name, shopId, userId],
    function(err) {
      if (err) return res.status(500).json({ error: "Error actualizando nombre" });
      res.json({ ok: true, name });
    }
  );
});

/* =====================================================
   OBTENER APP_SECRET DE UNA TIENDA (para reconectar)
   GET /api/shopify/secret/:id
   ===================================================== */
router.get("/secret/:id", auth, (req, res) => {
  const shopId = req.params.id;
  const userId = req.user.id;

  req.db.get(
    `SELECT app_secret FROM shops WHERE id = ? AND user_id = ?`,
    [shopId, userId],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: "No encontrada" });
      res.json({ app_secret: row.app_secret });
    }
  );
});

/* =====================================================
   ELIMINAR TIENDA
   DELETE /api/shopify/delete/:id
   ===================================================== */
router.delete("/delete/:id", auth, (req, res) => {
  const shopId = req.params.id;
  const userId = req.user.id;

  req.db.run(
    `DELETE FROM shops WHERE id = ? AND user_id = ?`,
    [shopId, userId],
    function(err) {
      if (err) return res.status(500).json({ error: "Error eliminando tienda" });
      if (this.changes === 0) return res.status(404).json({ error: "Tienda no encontrada" });
      res.json({ ok: true });
    }
  );
});

/* =====================================================
   SYNC PEDIDOS DESDE SHOPIFY
   POST /api/shopify/sync-orders
   ===================================================== */
router.post("/sync-orders", auth, async (req, res) => {
  const userId = req.user.id;

  req.db.all(
    `SELECT id, shop_domain, access_token FROM shops WHERE user_id = ? AND status = 'active'`,
    [userId],
    async (err, shops) => {
      if (err || !shops.length) {
        return res.json({ ok: true, synced: 0 });
      }

      let total = 0;

      for (const shop of shops) {
        try {
          const r = await fetch(
            `https://${shop.shop_domain}/admin/api/2024-10/orders.json?status=any&limit=250`,
            { headers: { "X-Shopify-Access-Token": shop.access_token } }
          );

          if (!r.ok) continue;

          const { orders } = await r.json();

          for (const o of orders) {
            const customerName =
              o.customer
                ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
                : "Desconocido";

            const fulfillmentStatus = o.fulfillment_status || "pendiente";

            const trackingNumber =
              o.fulfillments?.[0]?.tracking_number || null;

            await new Promise((resolve) => {
              req.db.run(
                `INSERT INTO orders (
                  shop_id, order_id, order_number, customer_name,
                  fulfillment_status, tracking_number, total_price, currency, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(order_id) DO UPDATE SET
                  fulfillment_status = excluded.fulfillment_status,
                  tracking_number = excluded.tracking_number`,
                [
                  shop.id,
                  String(o.id),
                  o.order_number,
                  customerName,
                  fulfillmentStatus,
                  trackingNumber,
                  o.total_price,
                  o.currency,
                  o.created_at,
                ],
                resolve
              );
            });

            total++;
          }
        } catch (e) {
          console.error("Sync error for shop", shop.shop_domain, e);
        }
      }

      res.json({ ok: true, synced: total });
    }
  );
});

module.exports = router;