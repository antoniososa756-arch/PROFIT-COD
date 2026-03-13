const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

async function ensureBaseRows(userId) {
  // Filas fijas
  const fijos = await db.all("SELECT nombre FROM gastos_fijos WHERE user_id = ? AND fijo = 1", [userId]);
  const nombres = fijos.map(f => f.nombre);
  if (!nombres.includes("MRW"))
    await db.run("INSERT INTO gastos_fijos (user_id, nombre, precio_unit, fijo, orden) VALUES (?, 'MRW', 0, 1, 0)", [userId]);
  if (!nombres.includes("LOGÍSTICA"))
    await db.run("INSERT INTO gastos_fijos (user_id, nombre, precio_unit, fijo, orden) VALUES (?, 'LOGÍSTICA', 0, 1, 1)", [userId]);

  // Filas vacías editables
  const all = await db.all("SELECT id FROM gastos_fijos WHERE user_id = ?", [userId]);
  if (all.length <= 2) {
    for (let orden = 2; orden <= 6; orden++) {
      await db.run("INSERT INTO gastos_fijos (user_id, nombre, precio_unit, fijo, orden) VALUES (?, '', NULL, 0, ?)", [userId, orden]);
    }
  }
}

// GET
router.get("/", auth, async (req, res) => {
  const { mes } = req.query;
  const userId = req.user.id;
  try {
    await ensureBaseRows(userId);
    const items = await db.all("SELECT * FROM gastos_fijos WHERE user_id = ? ORDER BY orden ASC, id ASC", [userId]);
    if (!mes) return res.json(items.map(i => ({ ...i, valor: 0 })));

    const valores = await db.all("SELECT * FROM gastos_fijos_valores WHERE user_id = ? AND mes = ?", [userId, mes]);
    const precios = await db.all("SELECT * FROM gastos_fijos_precios WHERE user_id = ? AND mes = ?", [userId, mes]);

    const mapVal = {}, mapPre = {};
    valores.forEach(v => { mapVal[v.gasto_id] = v.valor; });
    precios.forEach(p => { mapPre[p.gasto_id] = p.precio_unit; });

    res.json(items.map(i => ({
      ...i,
      valor: mapVal[i.id] !== undefined ? mapVal[i.id] : 0,
      precio_unit: mapPre[i.id] !== undefined ? mapPre[i.id] : (i.precio_unit ?? 0),
    })));
  } catch (e) { console.error(e); res.status(500).json({ error: "Error BD" }); }
});

// POST /reset
router.post("/reset", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    await db.run("DELETE FROM gastos_fijos WHERE user_id = ? AND fijo = 0 AND (nombre IS NULL OR nombre = '')", [userId]);
    await ensureBaseRows(userId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error BD" }); }
});

// POST
router.post("/", auth, async (req, res) => {
  const { nombre, precio_unit, fijo, orden } = req.body;
  try {
    const result = await db.run(
      "INSERT INTO gastos_fijos (user_id, nombre, precio_unit, fijo, orden) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [req.user.id, nombre || "", precio_unit != null ? parseFloat(precio_unit) : null, fijo ? 1 : 0, orden || 0]
    );
    res.json({ id: result.lastID });
  } catch (e) { res.status(500).json({ error: "Error guardando" }); }
});

// PUT nombre/precio global
router.put("/:id", auth, async (req, res) => {
  const { nombre, precio_unit } = req.body;
  try {
    await db.run(
      "UPDATE gastos_fijos SET nombre = ?, precio_unit = ? WHERE id = ? AND user_id = ?",
      [nombre, precio_unit != null ? parseFloat(precio_unit) : null, req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error actualizando" }); }
});

// PUT valor mensual
router.put("/:id/valor", auth, async (req, res) => {
  const { mes, valor } = req.body;
  try {
    await db.run(
      `INSERT INTO gastos_fijos_valores (gasto_id, user_id, mes, valor) VALUES (?, ?, ?, ?)
       ON CONFLICT(gasto_id, user_id, mes) DO UPDATE SET valor = EXCLUDED.valor`,
      [req.params.id, req.user.id, mes, parseFloat(valor) || 0]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error guardando valor" }); }
});

// PUT precio mensual
router.put("/:id/precio", auth, async (req, res) => {
  const { mes, precio_unit } = req.body;
  try {
    await db.run(
      `INSERT INTO gastos_fijos_precios (gasto_id, user_id, mes, precio_unit) VALUES (?, ?, ?, ?)
       ON CONFLICT(gasto_id, user_id, mes) DO UPDATE SET precio_unit = EXCLUDED.precio_unit`,
      [req.params.id, req.user.id, mes, parseFloat(precio_unit) || 0]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error guardando precio" }); }
});

// DELETE
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.run("DELETE FROM gastos_fijos WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error eliminando" }); }
});

module.exports = router;
