const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

router.get("/", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const rows = await db.all(
      `SELECT o.id, o.order_number, o.created_at, o.tracking_number,
        o.fulfillment_status, o.financial_status, o.customer_name, o.total_price, o.currency,
        o.raw_json, s.shop_domain
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE o.shop_id IN (SELECT id FROM shops WHERE user_id = ?)
       ORDER BY o.created_at DESC`,
      [userId]
    );
    res.json(rows || []);
  } catch (e) {
    console.error("Orders fetch error:", e);
    res.status(500).json({ error: "Error obteniendo pedidos" });
  }
});

router.get("/reembolso-estado", auth, async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT order_id, estado FROM reembolsos_estado WHERE user_id = ?",
      [req.user.id]
    );
    res.json(rows || []);
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

router.post("/reembolso-estado", auth, async (req, res) => {
  const { order_id, estado } = req.body;
  try {
    await db.run(
      `INSERT INTO reembolsos_estado (user_id, order_id, estado)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, order_id) DO UPDATE SET estado = EXCLUDED.estado`,
      [req.user.id, order_id, estado]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

module.exports = router;