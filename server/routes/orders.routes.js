const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

router.get("/", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const rows = await db.all(
      `SELECT o.id, o.order_number, o.created_at, o.tracking_number,
        o.fulfillment_status, o.customer_name, o.total_price, o.currency,
        s.shop_domain
       FROM orders o
       JOIN shops s ON s.id = o.shop_id
       WHERE s.user_id = ?
       ORDER BY o.created_at DESC`,
      [userId]
    );
    res.json(rows || []);
  } catch (e) {
    console.error("Orders fetch error:", e);
    res.status(500).json({ error: "Error obteniendo pedidos" });
  }
});

module.exports = router;
