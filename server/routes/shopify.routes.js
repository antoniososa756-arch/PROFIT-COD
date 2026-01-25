const express = require("express");
const crypto = require("crypto");
const fetch = require("node-fetch");

const { getOrders } = require("../services/shopify.service");

const router = express.Router();

/* =====================================================
   OAUTH → INICIAR CONEXIÓN (INSTALAR APP EN SHOPIFY)
   GET /api/shopify/connect?shop=xxx.myshopify.com
   ===================================================== */
router.get("/connect", (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).send("Falta parámetro shop");
  }

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
  const { shop, hmac, code } = req.query;

  if (!shop || !hmac || !code) {
    return res.status(400).send("Parámetros inválidos");
  }

  // 🔐 Validar HMAC
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
    // 🔁 Intercambiar code por access token
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

    // ⚠️ SOLO REDIRIGIMOS – el guardado real se hace en /connect-token
    console.log("✅ Shopify OAuth OK:", shop);

    res.redirect("/?shopify=connected");

  } catch (err) {
    console.error("Shopify callback error:", err);
    res.status(500).send("Error en callback Shopify");
  }
});

/* =====================================================
   CONEXIÓN REAL CON TOKEN (PASO 4)
   POST /api/shopify/connect-token
   ===================================================== */
router.post("/connect-token", async (req, res) => {
  const { shop, accessToken } = req.body;
  const userId = req.user?.id;

  if (!shop || !accessToken) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  if (!userId) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    // 🔍 Validar token contra Shopify real
    const response = await fetch(
      `https://${shop}/admin/api/2024-01/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return res.status(401).json({ error: "Token Shopify inválido" });
    }

    const data = await response.json();

    // 💾 Guardar tienda
    await req.db.run(
      `
      INSERT INTO shops (user_id, shop_domain, access_token, status, last_sync)
      VALUES (?, ?, ?, 'active', datetime('now'))
      `,
      [userId, shop, accessToken]
    );

    res.json({
      ok: true,
      shop: {
        name: data.shop.name,
        domain: shop,
        status: "active",
        lastSync: new Date().toISOString(),
      },
    });

  } catch (err) {
    console.error("Shopify connect-token error:", err);
    res.status(500).json({ error: "Error conectando con Shopify" });
  }
});

// =========================
// LISTAR TIENDAS CONECTADAS
// =========================
router.get("/stores", async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    req.db.all(
      `
      SELECT
        id,
        shop_domain AS domain,
        status,
        last_sync,
        created_at
      FROM shops
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId],
      (err, rows) => {
        if (err) {
          console.error("DB shops error:", err);
          return res.status(500).json({ error: "Error base de datos" });
        }

        res.json(rows || []);
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error cargando tiendas" });
  }
});

/* =====================================================
   PEDIDOS (FUTURO)
   ===================================================== */
router.get("/orders", async (req, res) => {
  try {
    const orders = await getOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({
      error: "Error Shopify",
      detail: err.message,
    });
  }
});

module.exports = router;
