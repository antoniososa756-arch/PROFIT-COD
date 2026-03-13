const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM impuestos WHERE user_id = ? ORDER BY orden ASC, id ASC", [req.user.id]);
    res.json(rows || []);
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.post("/", auth, async (req, res) => {
  const { nombre, porcentaje, fijo, orden } = req.body;
  try {
    const result = await db.run(
      "INSERT INTO impuestos (user_id, nombre, porcentaje, fijo, orden) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [req.user.id, nombre || "", parseFloat(porcentaje) || 0, fijo ? 1 : 0, orden || 0]
    );
    res.json({ id: result.lastID });
  } catch (e) { res.status(500).json({ error: "Error guardando" }); }
});

router.put("/:id", auth, async (req, res) => {
  const { nombre, porcentaje } = req.body;
  try {
    await db.run(
      "UPDATE impuestos SET nombre = ?, porcentaje = ? WHERE id = ? AND user_id = ?",
      [nombre, parseFloat(porcentaje) || 0, req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error actualizando" }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await db.run("DELETE FROM impuestos WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error eliminando" }); }
});

module.exports = router;
