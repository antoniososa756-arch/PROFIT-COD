const auth = require("../middlewares/auth");
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
  let { shop } = req.query;

  if (!shop) {
    return res.status(400).send("Falta parámetro shop");
  }

  // 🔧 LIMPIAR DOMINIO
  shop = shop
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

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

  // 🔧 LIMPIAR DOMINIO
  shop = shop
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

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
   CONEXIÓN REAL CON TOKEN (PASO 4)
   POST /api/shopify/connect-token
   ===================================================== */
router.post("/connect-token", auth, async (req, res) => {
  let { shop, accessToken } = req.body;
  const userId = req.user?.id;

  if (!shop || !accessToken) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  if (!userId) {
    return res.status(401).json({ error: "No autorizado" });
  }

  // 🔧 LIMPIEZA CRÍTICA
  shop = shop
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  accessToken = accessToken.trim();

  try {
    // 🔍 VALIDACIÓN REAL CONTRA SHOPIFY
    const response = await fetch(
      `https://${shop}/admin/api/2026-01/shop.json`,
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

    // 💾 GUARDAR TIENDA
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

/* =====================================================
   LISTAR TIENDAS CONECTADAS
   GET /api/shopify/stores
   ===================================================== */
router.get("/stores", auth, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "No autorizado" });
  }

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
