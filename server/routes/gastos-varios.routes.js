const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

router.get("/", auth, async (req, res) => {
  const { mes } = req.query;
  if (!mes) return res.status(400).json({ error: "Falta mes" });
  try {
    const rows = await db.all("SELECT * FROM gastos_varios WHERE user_id = ? AND mes = ?", [req.user.id, mes]);
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.put("/shopify", auth, async (req, res) => {
  const { shop_domain, mes, shopify } = req.body;
  try {
    await db.run(
      `INSERT INTO gastos_varios (user_id, shop_domain, mes, shopify) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, shop_domain, mes) DO UPDATE SET shopify = EXCLUDED.shopify`,
      [req.user.id, shop_domain, mes, parseFloat(shopify) || 0]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error guardando" }); }
});

module.exports = router;
