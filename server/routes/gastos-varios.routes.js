const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

db.run(`
  CREATE TABLE IF NOT EXISTS gastos_varios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    shop_domain TEXT NOT NULL,
    mes TEXT NOT NULL,
    shopify REAL DEFAULT 0,
    UNIQUE(user_id, shop_domain, mes)
  )
`, () => {});

// GET — obtener gastos varios de un mes
router.get("/", auth, (req, res) => {
  const { mes } = req.query;
  const userId = req.user.id;
  if (!mes) return res.status(400).json({ error: "Falta mes" });

  db.all(
    `SELECT * FROM gastos_varios WHERE user_id=? AND mes=?`,
    [userId, mes],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error BD" });
      res.json(rows || []);
    }
  );
});

// PUT — guardar valor Shopify de una tienda
router.put("/shopify", auth, (req, res) => {
  const { shop_domain, mes, shopify } = req.body;
  db.run(
    `INSERT INTO gastos_varios (user_id, shop_domain, mes, shopify) VALUES (?,?,?,?)
     ON CONFLICT(user_id, shop_domain, mes) DO UPDATE SET shopify=excluded.shopify`,
    [req.user.id, shop_domain, mes, parseFloat(shopify)||0],
    (err) => {
      if (err) return res.status(500).json({ error: "Error guardando" });
      res.json({ ok: true });
    }
  );
});

module.exports = router;