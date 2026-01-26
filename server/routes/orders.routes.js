const express = require("express");
const auth = require("../middlewares/auth");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const rows = await req.db.all(
      `
      SELECT
        o.id,
        o.order_number,
        o.created_at,
        o.tracking_number,
        o.fulfillment_status,
        o.customer_name,
        o.total_price,
        o.currency
      FROM orders o
      JOIN shops s ON s.id = o.shop_id
      WHERE s.user_id = ?
      ORDER BY o.created_at DESC
      `,
      [userId]
    );

    res.json(rows || []);
  } catch (err) {
    console.error("Orders fetch error:", err);
    res.status(500).json({ error: "Error obteniendo pedidos" });
  }
});

module.exports = router;
