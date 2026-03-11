const express = require("express");
const auth = require("../middlewares/auth");
const router = express.Router();

router.get("/", auth, (req, res) => {
  const userId = req.user.id;
  console.log("📋 Buscando pedidos para user_id:", userId);

  req.db.all(
    `SELECT o.id, o.order_number, o.created_at, o.tracking_number,
      o.fulfillment_status, o.customer_name, o.total_price, o.currency,
      s.domain as shop_domain
     FROM orders o
     JOIN shops s ON s.id = o.shop_id
     WHERE s.user_id = ?
     ORDER BY o.created_at DESC`
    [userId],
    (err, rows) => {
      if (err) {
        console.error("Orders fetch error:", err);
        return res.status(500).json({ error: "Error obteniendo pedidos" });
      }
      console.log("✅ Pedidos encontrados:", rows ? rows.length : 0);
      res.json(rows || []);
    }
  );
});

module.exports = router;