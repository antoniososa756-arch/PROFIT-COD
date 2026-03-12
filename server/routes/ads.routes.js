const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

db.run(`
  CREATE TABLE IF NOT EXISTS ads_spend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    shop_domain TEXT NOT NULL,
    date TEXT NOT NULL,
    meta REAL DEFAULT 0,
    tiktok REAL DEFAULT 0,
    UNIQUE(user_id, shop_domain, date)
  )
`);

router.get("/", auth, (req, res) => {
  const { shop, month, year } = req.query;
  const userId = req.user.id;
  if (!shop || !month || !year) return res.status(400).json({ error: "Faltan parámetros" });

  const from = `${year}-${String(month).padStart(2,"0")}-01`;
  const to   = `${year}-${String(month).padStart(2,"0")}-31`;

  db.all(
    `SELECT date, meta, tiktok FROM ads_spend
     WHERE user_id=? AND shop_domain=? AND date>=? AND date<=?
     ORDER BY date ASC`,
    [userId, shop, from, to],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error BD" });
      res.json(rows || []);
    }
  );
});

router.post("/", auth, (req, res) => {
  const { shop, date, type, spend } = req.body;
  const userId = req.user.id;
  if (!shop || !date || !type) return res.status(400).json({ error: "Faltan parámetros" });

  const col = type === "tiktok" ? "tiktok" : "meta";

  db.run(
    `INSERT INTO ads_spend (user_id, shop_domain, date, ${col})
     VALUES (?,?,?,?)
     ON CONFLICT(user_id, shop_domain, date)
     DO UPDATE SET ${col}=excluded.${col}`,
    [userId, shop, date, parseFloat(spend)||0],
    (err) => {
      if (err) return res.status(500).json({ error: "Error guardando" });
      res.json({ ok: true });
    }
  );
});

module.exports = router;