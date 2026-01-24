const express = require("express");
const crypto = require("crypto");
const fetch = require("node-fetch");

const { getOrders } = require("../services/shopify.service");

const router = express.Router();

// =========================
// OAUTH → INICIO (ya lo tienes)
// =========================
// NOTA: este endpoint debe existir ya:
// GET /api/shopify/connect
// (si no, lo revisamos después)

// =========================
// OAUTH → CALLBACK
// =========================
router.get("/callback", async (req, res) => {
  const { shop, hmac, code } = req.query;

  if (!shop || !hmac || !code) {
    return res.status(400).send("Parámetros inválidos");
  }

  // 1️⃣ Validar HMAC
  const query = { ...req.query };
  delete query.hmac;
  delete query.signature;

  const message = Object.keys(query)
    .sort()
    .map(key => `${key}=${query[key]}`)
    .join("&");

  const generatedHmac = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");

  if (generatedHmac !== hmac) {
    return res.status(401).send("HMAC inválido");
  }

  try {
    // 2️⃣ Intercambiar code por access_token
    const tokenRes = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code
        })
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(400).json(tokenData);
    }

    const accessToken = tokenData.access_token;

    // ⚠️ DE MOMENTO SOLO LOG (PASO ACTUAL)
    console.log("SHOP CONECTADA:", shop);
    console.log("ACCESS TOKEN:", accessToken);

    // 3️⃣ Volver al panel
    res.redirect("/?shopify=connected");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error en callback Shopify");
  }
});

// =========================
// PEDIDOS (AÚN NO SE USAN)
// =========================
router.get("/orders", async (req, res) => {
  try {
    const orders = await getOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({
      error: "Error Shopify",
      detail: err.message
    });
  }
});

module.exports = router;

// =========================
// OAUTH → INICIAR CONEXIÓN
// =========================
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

// 👉 INICIAR CONEXIÓN SHOPIFY
router.get("/connect", (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).send("Falta el dominio shop");
  }

  const redirectUri = "http://localhost:3001/api/shopify/callback";
  const scopes = "read_orders";
  const state = crypto.randomBytes(16).toString("hex");

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${scopes}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}`;

  console.log("➡️ REDIRIGIENDO A SHOPIFY:", installUrl);

  res.redirect(installUrl);
});


