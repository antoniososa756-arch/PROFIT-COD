const express = require("express");
const webpush = require("web-push");
const { PNG } = require("pngjs");
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
  console.warn("[Push] VAPID keys no configuradas — push desactivado");
}

// Pixel font 5x7 para dígitos — puro JS, sin fuentes del sistema
const DIGITS = {
  "0": ["01110","10001","10001","10001","10001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"],
  "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","11110","00001","00001","10001","01110"],
  "6": ["00110","01000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00010","01100"],
};

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function generateIconPng(color, num) {
  const SIZE = 192;
  const RADIUS = 38;
  const png = new PNG({ width: SIZE, height: SIZE, filterType: -1 });
  const { r: cr, g: cg, b: cb } = hexToRgb(color);

  // Rellenar píxeles: fondo del color con esquinas redondeadas
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;
      // Comprobar si el píxel está dentro del rectángulo redondeado
      const inCornerTL = x < RADIUS && y < RADIUS;
      const inCornerTR = x >= SIZE - RADIUS && y < RADIUS;
      const inCornerBL = x < RADIUS && y >= SIZE - RADIUS;
      const inCornerBR = x >= SIZE - RADIUS && y >= SIZE - RADIUS;
      let inside = true;
      if (inCornerTL) inside = Math.hypot(x - RADIUS, y - RADIUS) <= RADIUS;
      else if (inCornerTR) inside = Math.hypot(x - (SIZE - RADIUS), y - RADIUS) <= RADIUS;
      else if (inCornerBL) inside = Math.hypot(x - RADIUS, y - (SIZE - RADIUS)) <= RADIUS;
      else if (inCornerBR) inside = Math.hypot(x - (SIZE - RADIUS), y - (SIZE - RADIUS)) <= RADIUS;

      if (inside) {
        png.data[idx] = cr; png.data[idx + 1] = cg;
        png.data[idx + 2] = cb; png.data[idx + 3] = 255;
      } else {
        png.data[idx] = png.data[idx + 1] = png.data[idx + 2] = png.data[idx + 3] = 0;
      }
    }
  }

  // Dibujar dígitos en blanco
  if (num !== null && num !== undefined && !isNaN(num)) {
    const str = String(num);
    const DIGIT_W = 5, DIGIT_H = 7;
    const numDigits = str.length;
    // Ajustar tamaño del píxel según cuántos dígitos
    const PX = numDigits === 1 ? 20 : numDigits === 2 ? 15 : 11;
    const GAP = numDigits === 1 ? 4 : 3;
    const totalW = numDigits * DIGIT_W * PX + (numDigits - 1) * GAP;
    const totalH = DIGIT_H * PX;
    let startX = Math.floor((SIZE - totalW) / 2);
    const startY = Math.floor((SIZE - totalH) / 2);

    for (const ch of str) {
      const pattern = DIGITS[ch];
      if (!pattern) { startX += DIGIT_W * PX + GAP; continue; }
      for (let row = 0; row < DIGIT_H; row++) {
        for (let col = 0; col < DIGIT_W; col++) {
          if (pattern[row][col] === "1") {
            for (let py = 0; py < PX; py++) {
              for (let px = 0; px < PX; px++) {
                const x = startX + col * PX + px;
                const y = startY + row * PX + py;
                if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
                  const idx = (y * SIZE + x) * 4;
                  png.data[idx] = 255; png.data[idx + 1] = 255;
                  png.data[idx + 2] = 255; png.data[idx + 3] = 255;
                }
              }
            }
          }
        }
      }
      startX += DIGIT_W * PX + GAP;
    }
  }

  return PNG.sync.write(png);
}

// Icono PNG generado con pixel font puro JS
router.get("/icon", (req, res) => {
  const color = /^#[0-9a-fA-F]{6}$/.test(req.query.color) ? req.query.color : "#3b82f6";
  const num = req.query.n !== undefined ? parseInt(req.query.n) : null;
  const buf = generateIconPng(color, num);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-cache");
  res.send(buf);
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
  if (!subs.length) return res.status(404).json({ error: "No hay suscripciones. Acepta el permiso de notificaciones primero." });
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ error: "VAPID no configurado." });

  const color = req.body.color || "#3b82f6";
  const shopName = req.body.shopName || "Tienda de prueba";
  const iconUrl = `${process.env.APP_URL}/api/push/icon?color=${encodeURIComponent(color)}&n=1`;
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
