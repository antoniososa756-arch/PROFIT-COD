const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

const PLANS = {
  basic:    { name: "Básico",   price: 9.99,  stores: 1  },
  pro:      { name: "Pro",      price: 19.99, stores: 4  },
  business: { name: "Business", price: 29.99, stores: 10 },
};

// Obtener configuración de pagos desde DB (con fallback a env vars)
async function getPaymentConfig() {
  try {
    const row = await db.get("SELECT * FROM payment_config WHERE id = 1");
    return {
      stripeSecretKey:     row?.stripe_secret_key     || process.env.STRIPE_SECRET_KEY     || "",
      stripeWebhookSecret: row?.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || "",
      stripePublicKey:     row?.stripe_public_key     || process.env.STRIPE_PUBLIC_KEY     || "",
      paypalClientId:      row?.paypal_client_id      || process.env.PAYPAL_CLIENT_ID      || "",
      paypalSecret:        row?.paypal_secret         || process.env.PAYPAL_SECRET         || "",
      paypalEnv:           row?.paypal_env            || process.env.PAYPAL_ENV            || "live",
    };
  } catch {
    return {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
      stripePublicKey: process.env.STRIPE_PUBLIC_KEY || "",
      paypalClientId: process.env.PAYPAL_CLIENT_ID || "",
      paypalSecret: process.env.PAYPAL_SECRET || "",
      paypalEnv: process.env.PAYPAL_ENV || "live",
    };
  }
}

// GET /api/billing/plan — plan actual del usuario
router.get("/plan", auth, async (req, res) => {
  try {
    const user = await db.get(
      "SELECT plan, plan_status, plan_expires_at FROM users WHERE id = $1",
      [req.user.id]
    );
    res.json({
      plan:       user?.plan       || "free",
      status:     user?.plan_status || "inactive",
      expires_at: user?.plan_expires_at || null,
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/billing/stripe/create-session
router.post("/stripe/create-session", auth, async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: "Plan inválido" });

  const cfg = await getPaymentConfig();
  if (!cfg.stripeSecretKey) return res.status(503).json({ error: "Stripe no configurado" });

  try {
    const stripe = require("stripe")(cfg.stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: `ProfitCod ${PLANS[plan].name} — 1 mes` },
          unit_amount: Math.round(PLANS[plan].price * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.APP_URL}/?payment=success&plan=${plan}`,
      cancel_url:  `${process.env.APP_URL}/?payment=cancelled`,
      metadata: { userId: String(req.user.id), plan },
    });
    res.json({ url: session.url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/billing/stripe/webhook  (raw body se configura en index.js)
router.post("/stripe/webhook", async (req, res) => {
  const cfg = await getPaymentConfig();
  if (!cfg.stripeSecretKey || !cfg.stripeWebhookSecret) return res.status(503).send("Stripe no configurado");

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    const stripe = require("stripe")(cfg.stripeSecretKey);
    event = stripe.webhooks.constructEvent(req.body, sig, cfg.stripeWebhookSecret);
  } catch(e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { userId, plan } = session.metadata || {};
    if (userId && PLANS[plan]) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.run(
        "UPDATE users SET plan = $1, plan_status = 'active', plan_expires_at = $2 WHERE id = $3",
        [plan, expiresAt, parseInt(userId)]
      ).catch(e => console.error("billing db error:", e.message));
    }
  }

  res.json({ received: true });
});

// GET /api/billing/paypal/client-id — expone el PayPal client_id al frontend
router.get("/paypal/client-id", auth, async (req, res) => {
  const cfg = await getPaymentConfig();
  res.json({ client_id: cfg.paypalClientId || "" });
});

// ── PayPal helpers ────────────────────────────────────────────
async function getPayPalToken() {
  const cfg = await getPaymentConfig();
  const clientId = cfg.paypalClientId;
  const secret   = cfg.paypalSecret;
  if (!clientId || !secret) throw new Error("PayPal no configurado");

  const base = cfg.paypalEnv === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

  const creds = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("No se pudo obtener token PayPal");
  return { token: data.access_token, base };
}

// POST /api/billing/paypal/create-order
router.post("/paypal/create-order", auth, async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: "Plan inválido" });
  try {
    const { token, base } = await getPayPalToken();
    const r = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "EUR", value: PLANS[plan].price.toFixed(2) },
          description: `ProfitCod ${PLANS[plan].name} — 1 mes`,
        }],
      }),
    });
    const data = await r.json();
    if (!data.id) return res.status(500).json({ error: "Error creando orden PayPal", detail: data });
    res.json({ orderID: data.id });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/billing/paypal/capture
router.post("/paypal/capture", auth, async (req, res) => {
  const { orderID, plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: "Plan inválido" });
  try {
    const { token, base } = await getPayPalToken();
    const r = await fetch(`${base}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await r.json();
    if (data.status === "COMPLETED") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.run(
        "UPDATE users SET plan = $1, plan_status = 'active', plan_expires_at = $2 WHERE id = $3",
        [plan, expiresAt, req.user.id]
      );
      res.json({ ok: true, plan, expires_at: expiresAt });
    } else {
      res.status(400).json({ error: "Pago no completado", status: data.status });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, PLANS };
