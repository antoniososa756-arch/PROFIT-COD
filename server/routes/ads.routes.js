const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

router.get("/", auth, async (req, res) => {
  const { shop, month, year } = req.query;
  const userId = req.user.id;
  if (!shop || !month || !year) return res.status(400).json({ error: "Faltan parámetros" });

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to   = `${year}-${String(month).padStart(2, "0")}-31`;

  try {
    const rows = await db.all(
      `SELECT date, meta, tiktok FROM ads
       WHERE user_id = ? AND shop_domain = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`,
      [userId, shop, from, to]
    );
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.post("/", auth, async (req, res) => {
  const { shop, date, type, spend } = req.body;
  const userId = req.user.id;
  if (!shop || !date || !type) return res.status(400).json({ error: "Faltan parámetros" });

  const col = type === "tiktok" ? "tiktok" : "meta";

  try {
    await db.run(
      `INSERT INTO ads (user_id, shop_domain, date, ${col}) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, shop_domain, date) DO UPDATE SET ${col} = EXCLUDED.${col}`,
      [userId, shop, date, parseFloat(spend) || 0]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error guardando" }); }
});

module.exports = router;
