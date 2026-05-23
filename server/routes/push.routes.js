const express = require("express");
const webpush = require("web-push");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@profit-cod.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn("[Push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas — push desactivado");
}

// Icono SVG de color dinámico para las notificaciones
router.get("/icon", (req, res) => {
  const color = /^#[0-9a-fA-F]{6}$/.test(req.query.color) ? req.query.color : "#3b82f6";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="40" fill="${color}"/></svg>`;
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(svg);
});

// Guardar suscripción push del navegador
router.post("/subscribe", auth, async (req, res) => {
  const userId = req.user.id;
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: "Suscripción inválida" });
  try {
    await db.run(
      `INSERT INTO push_subscriptions (user_id, endpoint, subscription)
       VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE SET subscription = EXCLUDED.subscription, user_id = EXCLUDED.user_id`,
      [userId, sub.endpoint, JSON.stringify(sub)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("[Push] Error guardando suscripción:", e.message);
    res.status(500).json({ error: "Error BD" });
  }
});

// Notificación de prueba
router.post("/test", auth, async (req, res) => {
  const userId = req.user.id;
  const subs = await db.all("SELECT endpoint, subscription FROM push_subscriptions WHERE user_id = $1", [userId]);
  if (!subs.length) return res.status(404).json({ error: "No hay suscripciones registradas. Acepta el permiso de notificaciones primero." });
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ error: "VAPID no configurado en el servidor." });

  const color = req.body.color || "#3b82f6";
  const shopName = req.body.shopName || "Tienda de prueba";
  const iconUrl = `${process.env.APP_URL}/api/push/icon?color=${encodeURIComponent(color)}`;
  const payload = JSON.stringify({
    title: `#1 — ${shopName}`,
    body: "Referencia: #TEST-001",
    icon: iconUrl,
    tag: "order-test-" + Date.now(),
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(JSON.parse(sub.subscription), payload);
      sent++;
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await db.run("DELETE FROM push_subscriptions WHERE endpoint = $1", [sub.endpoint]);
      }
    }
  }
  res.json({ ok: true, sent });
});

module.exports = { router, webpush };
