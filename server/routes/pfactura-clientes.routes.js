const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

// Clientes guardados por el usuario (a quién factura), reutilizables al
// crear una factura sin tener que reescribir sus datos cada vez.
// Estrictamente personales: se usa el id propio del login (own_id para
// apoyo, que si no apuntaría a los del cliente padre), no compartidos.
const ownerId = req => req.user.own_id || req.user.id;

router.get("/", auth, async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM pfactura_clientes WHERE user_id = ? ORDER BY id DESC", [ownerId(req)]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

router.post("/", auth, async (req, res) => {
  const { nombre, identificacion, email, telefono, direccion1, direccion2, ciudad, pais } = req.body || {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: "Falta el nombre" });
  try {
    const result = await db.run(
      `INSERT INTO pfactura_clientes (user_id, nombre, identificacion, email, telefono, direccion1, direccion2, ciudad, pais)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [ownerId(req), nombre.trim(), (identificacion || "").trim() || null, (email || "").trim() || null,
       (telefono || "").trim() || null, (direccion1 || "").trim() || null, (direccion2 || "").trim() || null,
       (ciudad || "").trim() || null, (pais || "").trim() || null]
    );
    res.json({ id: result.lastID });
  } catch (e) { res.status(500).json({ error: "Error guardando" }); }
});

router.put("/:id", auth, async (req, res) => {
  const { nombre, identificacion, email, telefono, direccion1, direccion2, ciudad, pais } = req.body || {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: "Falta el nombre" });
  try {
    await db.run(
      `UPDATE pfactura_clientes SET nombre = ?, identificacion = ?, email = ?, telefono = ?,
        direccion1 = ?, direccion2 = ?, ciudad = ?, pais = ? WHERE id = ? AND user_id = ?`,
      [nombre.trim(), (identificacion || "").trim() || null, (email || "").trim() || null,
       (telefono || "").trim() || null, (direccion1 || "").trim() || null, (direccion2 || "").trim() || null,
       (ciudad || "").trim() || null, (pais || "").trim() || null, req.params.id, ownerId(req)]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error actualizando" }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await db.run("DELETE FROM pfactura_clientes WHERE id = ? AND user_id = ?", [req.params.id, ownerId(req)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error eliminando" }); }
});

module.exports = router;
