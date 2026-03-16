const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

// Crear tabla extras si no existe
async function initExtrasTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS gastos_varios_extras (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      shop_domain TEXT NOT NULL,
      mes TEXT NOT NULL,
      nombre TEXT DEFAULT '',
      valor NUMERIC(10,2) DEFAULT 0
    )
  `);
}
initExtrasTable().catch(console.error);

// GET shopify por mes
router.get("/", auth, async (req, res) => {
  const { mes } = req.query;
  if (!mes) return res.status(400).json({ error: "Falta mes" });
  try {
    const rows = await db.all("SELECT * FROM gastos_varios WHERE user_id = $1 AND mes = $2", [req.user.id, mes]);
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

// PUT shopify
router.put("/shopify", auth, async (req, res) => {
  const { shop_domain, mes, shopify } = req.body;
  try {
    await db.run(
      `INSERT INTO gastos_varios (user_id, shop_domain, mes, shopify) VALUES ($1, $2, $3, $4)
       ON CONFLICT(user_id, shop_domain, mes) DO UPDATE SET shopify = EXCLUDED.shopify`,
      [req.user.id, shop_domain, mes, parseFloat(shopify) || 0]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error guardando" }); }
});

// GET extras por mes
router.get("/extras", auth, async (req, res) => {
  const { mes } = req.query;
  if (!mes) return res.status(400).json({ error: "Falta mes" });
  try {
    const rows = await db.all(
      "SELECT * FROM gastos_varios_extras WHERE user_id = $1 AND mes = $2 ORDER BY id ASC",
      [req.user.id, mes]
    );
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

// POST extra (crear nuevo concepto)
router.post("/extras", auth, async (req, res) => {
  const { shop_domain, mes, nombre, valor } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO gastos_varios_extras (user_id, shop_domain, mes, nombre, valor) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [req.user.id, shop_domain, mes, nombre || '', parseFloat(valor) || 0]
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (e) { res.status(500).json({ error: "Error guardando" }); }
});

// PUT extra (actualizar nombre o valor)
router.put("/extras/:id", auth, async (req, res) => {
  const { nombre, valor } = req.body;
  try {
    await db.run(
      "UPDATE gastos_varios_extras SET nombre = $1, valor = $2 WHERE id = $3 AND user_id = $4",
      [nombre || '', parseFloat(valor) || 0, req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error actualizando" }); }
});

// DELETE extra
router.delete("/extras/:id", auth, async (req, res) => {
  try {
    await db.run(
      "DELETE FROM gastos_varios_extras WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error eliminando" }); }
});

module.exports = router;