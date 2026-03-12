const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

db.run(`
  CREATE TABLE IF NOT EXISTS gastos_fijos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    valor REAL DEFAULT 0,
    estimado REAL DEFAULT NULL,
    fijo INTEGER DEFAULT 0,
    orden INTEGER DEFAULT 0
  )
`);

// GET — obtener todos los gastos fijos del usuario
router.get("/", auth, (req, res) => {
  db.all(
    `SELECT * FROM gastos_fijos WHERE user_id=? ORDER BY orden ASC, id ASC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error BD" });
      res.json(rows || []);
    }
  );
});

// POST — crear nuevo gasto fijo
router.post("/", auth, (req, res) => {
  const { nombre, valor, estimado, fijo, orden } = req.body;
  db.run(
    `INSERT INTO gastos_fijos (user_id, nombre, valor, estimado, fijo, orden)
     VALUES (?,?,?,?,?,?)`,
    [req.user.id, nombre||"", parseFloat(valor)||0, estimado!=null?parseFloat(estimado):null, fijo?1:0, orden||0],
    function(err) {
      if (err) return res.status(500).json({ error: "Error guardando" });
      res.json({ id: this.lastID });
    }
  );
});

// PUT — actualizar gasto fijo
router.put("/:id", auth, (req, res) => {
  const { nombre, valor, estimado } = req.body;
  db.run(
    `UPDATE gastos_fijos SET nombre=?, valor=?, estimado=?
     WHERE id=? AND user_id=?`,
    [nombre, parseFloat(valor)||0, estimado!=null?parseFloat(estimado):null, req.params.id, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Error actualizando" });
      res.json({ ok: true });
    }
  );
});

// DELETE — eliminar gasto fijo
router.delete("/:id", auth, (req, res) => {
  db.run(
    `DELETE FROM gastos_fijos WHERE id=? AND user_id=?`,
    [req.params.id, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Error eliminando" });
      res.json({ ok: true });
    }
  );
});

module.exports = router;