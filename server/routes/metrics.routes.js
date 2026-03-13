const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

router.get("/metrics", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const row = await db.get(
      `SELECT
        COUNT(DISTINCT shops.id) AS tiendas,
        COUNT(DISTINCT orders.id) AS pedidos,
        COALESCE(SUM(orders.total_price), 0) AS facturacion
       FROM users
       LEFT JOIN shops ON shops.user_id = users.id
       LEFT JOIN orders ON orders.shop_id = shops.id
       WHERE users.id = ?`,
      [userId]
    );
    res.json({ tiendas: row?.tiendas || 0, pedidos: row?.pedidos || 0, facturacion: row?.facturacion || 0 });
  } catch (e) { res.status(500).json({ error: "Error métricas" }); }
});

module.exports = router;
