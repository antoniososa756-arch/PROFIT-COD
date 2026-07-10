const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// TEMPORAL: diagnóstico de solo lectura (order_number → estado en reembolsos_estado)
const DEBUG_SECRET = "b742c9bbd9551cd7b966cabc9651fa79461dbd70";
router.get("/debug-reembolso/:orderNumber", async (req, res) => {
  if (req.query.secret !== DEBUG_SECRET) return res.status(403).json({ error: "forbidden" });
  try {
    const orders = await db.all(
      `SELECT o.id, o.order_number, o.financial_status, o.fulfillment_status,
              re.order_id as re_order_id, re.user_id as re_user_id, re.estado, re.fecha_pago
       FROM orders o
       LEFT JOIN reembolsos_estado re ON re.order_id = o.id::text
       WHERE o.order_number ILIKE $1`,
      [`%${req.params.orderNumber}%`]
    );
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

