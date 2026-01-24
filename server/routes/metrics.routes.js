const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");

const router = express.Router();

/* =========================
   MÉTRICAS DEL CLIENTE
   ========================= */
router.get("/metrics", auth, (req, res) => {
  const userId = req.user.id;

  // ⚠️ de momento métricas simples (reales pero básicas)
  db.get(
    `
    SELECT
      COUNT(DISTINCT shops.id)      AS tiendas,
      COUNT(DISTINCT orders.id)     AS pedidos,
      IFNULL(SUM(orders.total), 0)  AS facturacion
    FROM users
    LEFT JOIN shops   ON shops.user_id = users.id
    LEFT JOIN orders  ON orders.user_id = users.id
    WHERE users.id = ?
    `,
    [userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: "Error métricas" });
      }

      res.json({
        tiendas: row.tiendas || 0,
        pedidos: row.pedidos || 0,
        facturacion: row.facturacion || 0
      });
    }
  );
});

module.exports = router;
