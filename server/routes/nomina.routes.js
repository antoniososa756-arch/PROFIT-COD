const express = require("express");
const router = express.Router();
const db = require("../../db");
const { verifyToken } = require("../middlewares/auth");

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS nomina_trabajadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS nomina_pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trabajador_id INTEGER NOT NULL,
  mes TEXT NOT NULL,
  valor REAL DEFAULT 0,
  UNIQUE(trabajador_id, mes)
)`);

// GET trabajadores
router.get("/trabajadores", verifyToken, (req, res) => {
  db.all("SELECT * FROM nomina_trabajadores WHERE user_id = ? ORDER BY nombre", [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// POST crear trabajador
router.post("/trabajadores", verifyToken, (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  db.run("INSERT INTO nomina_trabajadores (nombre, user_id) VALUES (?, ?)", [nombre, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, nombre });
  });
});

// DELETE trabajador
router.delete("/trabajadores/:id", verifyToken, (req, res) => {
  db.run("DELETE FROM nomina_trabajadores WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// GET pagos del mes
router.get("/pagos", verifyToken, (req, res) => {
  const { mes } = req.query;
  db.all(`
    SELECT np.*, nt.nombre 
    FROM nomina_pagos np
    JOIN nomina_trabajadores nt ON nt.id = np.trabajador_id
    WHERE np.mes = ? AND nt.user_id = ?
  `, [mes, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// PUT guardar pago
router.put("/pagos", verifyToken, (req, res) => {
  const { trabajador_id, mes, valor } = req.body;
  db.run(`
    INSERT INTO nomina_pagos (trabajador_id, mes, valor) VALUES (?, ?, ?)
    ON CONFLICT(trabajador_id, mes) DO UPDATE SET valor = excluded.valor
  `, [trabajador_id, mes, valor || 0], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// GET total nómina del mes
router.get("/total", verifyToken, (req, res) => {
  const { mes } = req.query;
  db.get(`
    SELECT COALESCE(SUM(np.valor), 0) as total
    FROM nomina_pagos np
    JOIN nomina_trabajadores nt ON nt.id = np.trabajador_id
    WHERE np.mes = ? AND nt.user_id = ?
  `, [mes, req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ total: row?.total || 0 });
  });
});

module.exports = router;