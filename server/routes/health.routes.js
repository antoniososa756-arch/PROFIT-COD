const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// TEMPORAL: diagnóstico de solo lectura — verificar integridad de datos de un cliente
const DEBUG_SECRET = "9c2a5f8e3b7d1046f2e8a5c9b3d7f1e6a4c8b0d2";
router.get("/debug-client-data", async (req, res) => {
  if (req.query.secret !== DEBUG_SECRET) return res.status(403).json({ error: "forbidden" });
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "email requerido" });
  try {
    const user = await db.get(
      "SELECT id, email, role, plan, plan_status, plan_expires_at, trial_started_at, billing_cycle_start FROM users WHERE email = ?",
      [email]
    );
    if (!user) return res.json({ error: "usuario no encontrado" });

    const shops = await db.all("SELECT id, shop_domain, status FROM shops WHERE user_id = ?", [user.id]);
    const orderStats = await db.get(`
      SELECT COUNT(*) as total,
             MIN(created_at) as oldest,
             MAX(created_at) as newest,
             COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) as this_month
      FROM orders o
      WHERE (o.shop_id IN (SELECT id FROM shops WHERE user_id = ?) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = ?))
    `, [user.id, user.id]);

    res.json({ user, shops, orderStats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

