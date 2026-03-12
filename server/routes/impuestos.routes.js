const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

db.run(`
  CREATE TABLE IF NOT EXISTS impuestos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    porcentaje REAL DEFAULT 0,
    fijo INTEGER DEFAULT 0,
    orden INTEGER DEFAULT 0
  )
`);

router.get("/", auth, (req, res) => {
  db.all(
    `SELECT * FROM impuestos WHERE user_id=? ORDER BY orden ASC, id ASC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error BD" });
      res.json(rows || []);
    }
  );
});

router.post("/", auth, (req, res) => {
  const { nombre, porcentaje, fijo, orden } = req.body;
  db.run(
    `INSERT INTO impuestos (user_id, nombre, porcentaje, fijo, orden) VALUES (?,?,?,?,?)`,
    [req.user.id, nombre||"", parseFloat(porcentaje)||0, fijo?1:0, orden||0],
    function(err) {
      if (err) return res.status(500).json({ error: "Error guardando" });
      res.json({ id: this.lastID });
    }
  );
});

router.put("/:id", auth, (req, res) => {
  const { nombre, porcentaje } = req.body;
  db.run(
    `UPDATE impuestos SET nombre=?, porcentaje=? WHERE id=? AND user_id=?`,
    [nombre, parseFloat(porcentaje)||0, req.params.id, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Error actualizando" });
      res.json({ ok: true });
    }
  );
});

router.delete("/:id", auth, (req, res) => {
  db.run(
    `DELETE FROM impuestos WHERE id=? AND user_id=?`,
    [req.params.id, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Error eliminando" });
      res.json({ ok: true });
    }
  );
});

module.exports = router;