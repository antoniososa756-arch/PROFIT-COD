const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// TEMPORAL: corregir plan_status de una cuenta puntual afectada por el bug de
// grant-free-days (quedó en "active" en vez de "trial", activando el límite de
// pedidos del plan Starter). Solo lectura primero, luego confirma antes de escribir.
const DEBUG_SECRET = "7e3a9c1f6b4d802e5f9a3c7b1d6e4f0a8c2b5d9e";
router.get("/debug-fix-client-status", async (req, res) => {
  if (req.query.secret !== DEBUG_SECRET) return res.status(403).json({ error: "forbidden" });
  const { email, apply } = req.query;
  if (!email) return res.status(400).json({ error: "email requerido" });
  try {
    const user = await db.get(
      "SELECT id, email, plan, plan_status, plan_expires_at, stripe_subscription_id FROM users WHERE email = ?",
      [email]
    );
    if (!user) return res.json({ error: "usuario no encontrado" });
    if (apply === "1" && !user.stripe_subscription_id && user.plan_status === "active") {
      await db.run("UPDATE users SET plan_status = 'trial' WHERE id = ?", [user.id]);
      return res.json({ applied: true, before: user });
    }
    res.json({ applied: false, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

