const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require("../middlewares/auth");

// Crear tablas si no existen
async function initNominaTablas() {
  await db.query(`CREATE TABLE IF NOT EXISTS nomina_trabajadores (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS nomina_pagos (
    id SERIAL PRIMARY KEY,
    trabajador_id INTEGER NOT NULL,
    mes TEXT NOT NULL,
    valor REAL DEFAULT 0,
    UNIQUE(trabajador_id, mes)
  )`);
}
initNominaTablas().catch(console.error);

// GET trabajadores
router.get("/trabajadores", verifyToken, async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM nomina_trabajadores WHERE user_id = $1 ORDER BY nombre", [req.user.id]);
    res.json(rows || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST crear trabajador
router.post("/trabajadores", verifyToken, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  try {
    const result = await db.query("INSERT INTO nomina_trabajadores (nombre, user_id) VALUES ($1, $2) RETURNING id", [nombre, req.user.id]);
    res.json({ id: result.rows[0].id, nombre });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE trabajador
router.delete("/trabajadores/:id", verifyToken, async (req, res) => {
  try {
    await db.query("DELETE FROM nomina_pagos WHERE trabajador_id = $1", [req.params.id]);
    await db.query("DELETE FROM nomina_trabajadores WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET pagos del mes
router.get("/pagos", verifyToken, async (req, res) => {
  const { mes } = req.query;
  try {
    const rows = await db.all(`
      SELECT np.*, nt.nombre 
      FROM nomina_pagos np
      JOIN nomina_trabajadores nt ON nt.id = np.trabajador_id
      WHERE np.mes = $1 AND nt.user_id = $2
    `, [mes, req.user.id]);
    res.json(rows || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT guardar pago
router.put("/pagos", verifyToken, async (req, res) => {
  const { trabajador_id, mes, valor } = req.body;
  try {
    await db.query(`
      INSERT INTO nomina_pagos (trabajador_id, mes, valor) VALUES ($1, $2, $3)
      ON CONFLICT(trabajador_id, mes) DO UPDATE SET valor = EXCLUDED.valor
    `, [trabajador_id, mes, valor || 0]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET total nómina del mes
router.get("/total", verifyToken, async (req, res) => {
  const { mes } = req.query;
  try {
    const row = await db.get(`
      SELECT COALESCE(SUM(np.valor), 0) as total
      FROM nomina_pagos np
      JOIN nomina_trabajadores nt ON nt.id = np.trabajador_id
      WHERE np.mes = $1 AND nt.user_id = $2
    `, [mes, req.user.id]);
    res.json({ total: row?.total || 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;