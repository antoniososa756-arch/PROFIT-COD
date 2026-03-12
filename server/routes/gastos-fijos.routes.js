const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

db.run(`
  CREATE TABLE IF NOT EXISTS gastos_fijos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    fijo INTEGER DEFAULT 0,
    orden INTEGER DEFAULT 0
  )
`, () => {});

db.run(`ALTER TABLE gastos_fijos ADD COLUMN precio_unit REAL DEFAULT NULL`, () => {});

// Tabla de valores mensuales
db.run(`
  CREATE TABLE IF NOT EXISTS gastos_fijos_valores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gasto_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    mes TEXT NOT NULL,
    valor REAL DEFAULT 0,
    UNIQUE(gasto_id, user_id, mes)
  )
`, () => {});

// GET — gastos fijos + valores del mes indicado
router.get("/", auth, (req, res) => {
  const { mes } = req.query; // formato: "2026-03"
  const userId = req.user.id;

  db.all(
    `SELECT * FROM gastos_fijos WHERE user_id=? ORDER BY orden ASC, id ASC`,
    [userId],
    (err, items) => {
      if (err) return res.status(500).json({ error: "Error BD" });
      if (!mes) return res.json(items);

      db.all(
        `SELECT * FROM gastos_fijos_valores WHERE user_id=? AND mes=?`,
        [userId, mes],
        (err2, valores) => {
          if (err2) return res.status(500).json({ error: "Error BD valores" });
          const map = {};
          valores.forEach(v => { map[v.gasto_id] = v.valor; });
          const result = items.map(i => ({ ...i, valor: map[i.id] ?? 0 }));
          res.json(result);
        }
      );
    }
  );
});

// POST — crear gasto fijo
router.post("/", auth, (req, res) => {
  const { nombre, precio_unit, fijo, orden } = req.body;
  db.run(
    `INSERT INTO gastos_fijos (user_id, nombre, precio_unit, fijo, orden) VALUES (?,?,?,?,?)`,
    [req.user.id, nombre||"", precio_unit!=null?parseFloat(precio_unit):null, fijo?1:0, orden||0],
    function(err) {
      if (err) return res.status(500).json({ error: "Error guardando" });
      res.json({ id: this.lastID });
    }
  );
});

// PUT — actualizar nombre/precio_unit del gasto fijo
router.put("/:id", auth, (req, res) => {
  const { nombre, precio_unit } = req.body;
  db.run(
    `UPDATE gastos_fijos SET nombre=?, precio_unit=? WHERE id=? AND user_id=?`,
    [nombre, precio_unit!=null?parseFloat(precio_unit):null, req.params.id, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Error actualizando" });
      res.json({ ok: true });
    }
  );
});

// PUT valor mensual
router.put("/:id/valor", auth, (req, res) => {
  const { mes, valor } = req.body;
  db.run(
    `INSERT INTO gastos_fijos_valores (gasto_id, user_id, mes, valor) VALUES (?,?,?,?)
     ON CONFLICT(gasto_id, user_id, mes) DO UPDATE SET valor=excluded.valor`,
    [req.params.id, req.user.id, mes, parseFloat(valor)||0],
    (err) => {
      if (err) return res.status(500).json({ error: "Error guardando valor" });
      res.json({ ok: true });
    }
  );
});

// DELETE
router.delete("/:id", auth, (req, res) => {
  db.run(`DELETE FROM gastos_fijos WHERE id=? AND user_id=?`, [req.params.id, req.user.id], (err) => {
    if (err) return res.status(500).json({ error: "Error eliminando" });
    db.run(`DELETE FROM gastos_fijos_valores WHERE gasto_id=? AND user_id=?`, [req.params.id, req.user.id], () => {});
    res.json({ ok: true });
  });
});

module.exports = router;