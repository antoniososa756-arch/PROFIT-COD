const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

const PLANS = {
  starter:  { name: "Starter",  base_price: 9.99,  price_per_order: 0.09, order_limit: 100  },
  growth:   { name: "Growth",   base_price: 19.99, price_per_order: 0.07, order_limit: 500  },
  pro:      { name: "Pro",      base_price: 29.99, price_per_order: 0.05, order_limit: 1000 },
  business: { name: "Business", base_price: 39.99, price_per_order: 0.03, order_limit: null }, // null = sin límite
};

// Obtener configuración de pagos desde DB (con fallback a env vars)
async function getPaymentConfig() {
  try {
    const row = await db.get("SELECT * FROM payment_config WHERE id = 1");
    return {
      stripeSecretKey:      row?.stripe_secret_key      || process.env.STRIPE_SECRET_KEY     || "",
      stripeWebhookSecret:  row?.stripe_webhook_secret  || process.env.STRIPE_WEBHOOK_SECRET || "",
      stripePublicKey:      row?.stripe_public_key      || process.env.STRIPE_PUBLIC_KEY     || "",
      stripePriceStarter:   row?.stripe_price_starter   || "",
      stripePriceGrowth:    row?.stripe_price_growth    || "",
      stripePricePro:       row?.stripe_price_pro       || "",
      stripePriceBusiness:  row?.stripe_price_business  || "",
      paypalClientId:       row?.paypal_client_id       || process.env.PAYPAL_CLIENT_ID      || "",
      paypalSecret:         row?.paypal_secret          || process.env.PAYPAL_SECRET         || "",
      paypalEnv:            row?.paypal_env             || process.env.PAYPAL_ENV            || "live",
    };
  } catch {
    return {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
      stripePublicKey: process.env.STRIPE_PUBLIC_KEY || "",
      stripePriceStarter: "", stripePriceGrowth: "", stripePricePro: "", stripePriceBusiness: "",
      paypalClientId: process.env.PAYPAL_CLIENT_ID || "",
      paypalSecret: process.env.PAYPAL_SECRET || "",
      paypalEnv: process.env.PAYPAL_ENV || "live",
    };
  }
}

function getPriceId(cfg, plan) {
  return {
    starter:  cfg.stripePriceStarter,
    growth:   cfg.stripePriceGrowth,
    pro:      cfg.stripePricePro,
    business: cfg.stripePriceBusiness,
  }[plan] || "";
}

// Contar pedidos del mes actual para un usuario
async function getMonthlyOrders(userId) {
  const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const countRow = await db.get(`
    SELECT COUNT(*) as cnt FROM orders o
    WHERE o.shop_id IN (SELECT id FROM shops WHERE user_id = $1)
      AND o.created_at LIKE $2
  `, [userId, month + "%"]);
  return parseInt(countRow?.cnt || 0);
}

// GET /api/billing/plan — plan actual + uso mensual + bloqueo
router.get("/plan", auth, async (req, res) => {
  try {
    const user = await db.get(
      "SELECT plan, plan_status, plan_expires_at, trial_started_at, billing_cycle_start, subscription_cancel_at FROM users WHERE id = $1",
      [req.user.id]
    );
    const planKey = user?.plan || "free";
    const planInfo = PLANS[planKey] || null;

    let monthlyOrders = 0;
    if (planInfo && req.user.role !== "admin") {
      monthlyOrders = await getMonthlyOrders(req.user.id);
    }

    // ¿Está en trial?
    const trialStarted = user?.trial_started_at || null;
    const trialEndsAt  = trialStarted
      ? new Date(new Date(trialStarted).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const trialActive  = trialStarted && new Date() < new Date(trialEndsAt);

    // ¿Bloqueado por exceder pedidos?
    const orderLimit = planInfo?.order_limit ?? null;
    const isBlocked  = orderLimit !== null && monthlyOrders > orderLimit;

    // Días para fin de mes
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - now.getDate();

    // Coste variable estimado del mes
    const variableCost = planInfo ? +(monthlyOrders * planInfo.price_per_order).toFixed(2) : 0;

    res.json({
      plan:             planKey,
      status:           user?.plan_status    || "inactive",
      expires_at:       user?.plan_expires_at || null,
      trial_active:     !!trialActive,
      trial_ends_at:    trialEndsAt,
      had_trial:        !!trialStarted,
      monthly_orders:   monthlyOrders,
      order_limit:      orderLimit,
      is_blocked:       isBlocked,
      days_left_month:  daysLeft,
      base_price:       planInfo?.base_price       ?? null,
      price_per_order:  planInfo?.price_per_order  ?? null,
      variable_cost:    variableCost,
      estimated_total:       planInfo ? +(planInfo.base_price + variableCost).toFixed(2) : null,
      subscription_cancel_at: user?.subscription_cancel_at || null,
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/billing/start-trial — activa 7 días gratis (solo si nunca ha tenido trial)
router.post("/start-trial", auth, async (req, res) => {
  // El trial siempre usa el plan Starter (100 pedidos/mes)
  const plan = "starter";
  try {
    const user = await db.get(
      "SELECT plan_status, trial_started_at FROM users WHERE id = $1", [req.user.id]
    );
    if (user?.trial_started_at) return res.status(400).json({ error: "Ya usaste tu período de prueba gratuito" });
    if (user?.plan_status === "active") return res.status(400).json({ error: "Ya tienes un plan activo" });

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const cycleStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    await db.run(
      `UPDATE users SET plan = $1, plan_status = 'trial', plan_expires_at = $2,
       trial_started_at = $3, billing_cycle_start = $4 WHERE id = $5`,
      [plan, trialEndsAt, now.toISOString(), cycleStart, req.user.id]
    );
    res.json({ ok: true, plan, trial_ends_at: trialEndsAt });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/billing/invoice-preview — desglose estimado del mes actual
router.get("/invoice-preview", auth, async (req, res) => {
  try {
    const user = await db.get(
      "SELECT plan, plan_status, billing_cycle_start FROM users WHERE id = $1", [req.user.id]
    );
    const planKey  = user?.plan || "free";
    const planInfo = PLANS[planKey];
    if (!planInfo || user?.plan_status === "inactive") return res.json({ available: false });

    const ordersUsed = await getMonthlyOrders(req.user.id);
    const variableCost = +(ordersUsed * planInfo.price_per_order).toFixed(2);
    const total = +(planInfo.base_price + variableCost).toFixed(2);
    const now = new Date();
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    res.json({
      available:       true,
      plan:            planKey,
      base_price:      planInfo.base_price,
      orders_used:     ordersUsed,
      price_per_order: planInfo.price_per_order,
      variable_cost:   variableCost,
      total,
      cycle_start:     user?.billing_cycle_start?.slice(0, 10) || now.toISOString().slice(0, 7) + "-01",
      cycle_end:       cycleEnd,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/billing/stripe/create-session — crea suscripción mensual
router.post("/stripe/create-session", auth, async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: "Plan inválido" });

  const cfg = await getPaymentConfig();
  if (!cfg.stripeSecretKey) return res.status(503).json({ error: "Stripe no configurado" });
  const priceId = getPriceId(cfg, plan);
  if (!priceId) return res.status(503).json({ error: `Price ID para ${plan} no configurado. Añádelo en Configuración de pagos.` });

  try {
    const stripe = require("stripe")(cfg.stripeSecretKey);
    const user = await db.get("SELECT email, stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1", [req.user.id]);

    // Crear o reutilizar cliente Stripe
    let customerId = user?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: String(req.user.id) },
      });
      customerId = customer.id;
      await db.run("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, req.user.id]);
    }

    // Si ya tiene suscripción activa, redirigir al portal de cliente
    if (user?.stripe_subscription_id) {
      const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id).catch(() => null);
      if (sub && sub.status === "active") {
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${process.env.APP_URL}/?section=plan`,
        });
        return res.json({ url: portal.url });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/?payment=success&plan=${plan}`,
      cancel_url:  `${process.env.APP_URL}/?payment=cancelled`,
      metadata: { userId: String(req.user.id), plan },
      subscription_data: {
        // Alinear ciclo al 1 de cada mes para que siempre renueve el día 1
        billing_cycle_anchor: Math.floor(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime() / 1000),
        proration_behavior: "create_prorations",
        metadata: { userId: String(req.user.id), plan },
      },
    });
    res.json({ url: session.url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/billing/stripe/portal — portal de cliente para gestionar suscripción
router.get("/stripe/portal", auth, async (req, res) => {
  const cfg = await getPaymentConfig();
  if (!cfg.stripeSecretKey) return res.status(503).json({ error: "Stripe no configurado" });
  try {
    const stripe = require("stripe")(cfg.stripeSecretKey);
    const user = await db.get("SELECT stripe_customer_id FROM users WHERE id = $1", [req.user.id]);
    if (!user?.stripe_customer_id) return res.status(400).json({ error: "Sin suscripción activa" });
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.APP_URL}/?section=plan`,
    });
    res.json({ url: portal.url });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/billing/stripe/webhook
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

  try {
    if (event.type === "checkout.session.completed") {
      // Suscripción nueva creada
      const session = event.data.object;
      if (session.mode !== "subscription") return res.json({ received: true });
      const { userId, plan } = session.metadata || {};
      if (userId && PLANS[plan]) {
        const subId = session.subscription;
        const now = new Date();
        const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        await db.run(
          `UPDATE users SET plan = $1, plan_status = 'active',
           plan_expires_at = $2, billing_cycle_start = $3,
           stripe_subscription_id = $4 WHERE id = $5`,
          [plan,
           new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString(), // +35 días de margen
           cycleStart, subId, parseInt(userId)]
        );
        console.log(`[STRIPE] Suscripción activada: user ${userId} → ${plan}`);
      }

    } else if (event.type === "invoice.payment_succeeded") {
      // Renovación mensual pagada
      const invoice = event.data.object;
      if (invoice.billing_reason === "subscription_cycle" || invoice.billing_reason === "subscription_create") {
        const subId = invoice.subscription;
        const user = await db.get("SELECT id, plan FROM users WHERE stripe_subscription_id = $1", [subId]);
        if (user) {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString();
          const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          await db.run(
            `UPDATE users SET plan_status = 'active', plan_expires_at = $1, billing_cycle_start = $2 WHERE id = $3`,
            [expiresAt, cycleStart, user.id]
          );
          console.log(`[STRIPE] Renovación pagada: user ${user.id} → ${user.plan}`);
        }
      }

    } else if (event.type === "invoice.payment_failed") {
      // Pago fallido — suspender plan
      const invoice = event.data.object;
      const subId = invoice.subscription;
      if (subId) {
        const user = await db.get("SELECT id FROM users WHERE stripe_subscription_id = $1", [subId]);
        if (user) {
          await db.run(`UPDATE users SET plan_status = 'suspended' WHERE id = $1`, [user.id]);
          console.log(`[STRIPE] Pago fallido: user ${user.id} suspendido`);
        }
      }

    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const user = await db.get("SELECT id FROM users WHERE stripe_subscription_id = $1", [sub.id]);
      if (user) {
        if (sub.cancel_at_period_end) {
          // Guardar fecha de cancelación para mostrarla en la app
          const cancelAt = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
          await db.run(`UPDATE users SET subscription_cancel_at = $1 WHERE id = $2`, [cancelAt, user.id]);
          console.log(`[STRIPE] Cancelación programada: user ${user.id}, acceso hasta ${cancelAt}`);
        } else {
          // Reactivó la suscripción (deshizo la cancelación)
          await db.run(`UPDATE users SET subscription_cancel_at = NULL WHERE id = $1`, [user.id]);
        }
      }

    } else if (event.type === "customer.subscription.deleted") {
      // Suscripción cancelada definitivamente (ya expiró el período)
      const sub = event.data.object;
      const user = await db.get("SELECT id FROM users WHERE stripe_subscription_id = $1", [sub.id]);
      if (user) {
        await db.run(
          `UPDATE users SET plan_status = 'inactive', plan = 'free', stripe_subscription_id = NULL, subscription_cancel_at = NULL WHERE id = $1`,
          [user.id]
        );
        console.log(`[STRIPE] Suscripción cancelada: user ${user.id}`);
      }
    }
  } catch(e) { console.error("[STRIPE WEBHOOK] Error:", e.message); }

  res.json({ received: true });
});

// GET /api/billing/paypal/client-id
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
          amount: { currency_code: "EUR", value: PLANS[plan].base_price.toFixed(2) },
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
      const now = new Date();
      const expiresAt  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      await db.run(
        `UPDATE users SET plan = $1, plan_status = 'active', plan_expires_at = $2,
         billing_cycle_start = $3 WHERE id = $4`,
        [plan, expiresAt, cycleStart, req.user.id]
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
