const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// Progreso del relleno de datos de búsqueda (ver db.js): solo contadores,
// sin datos de pedidos.
router.get("/busqueda", async (req, res) => {
  try {
    const db = require("../db");
    const r = await db.get(`SELECT COUNT(*) AS pendientes FROM orders WHERE customer_email IS NULL OR search_text IS NULL OR note IS NULL`);
    res.json({ pendientes: Number(r?.pendientes || 0), ...(global.__rellenoBusqueda || {}) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
