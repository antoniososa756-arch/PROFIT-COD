const express = require("express");
const db = require("../db");
const router = express.Router();

// Contabilidad es exclusiva del admin. Su apoyo delegado (parent_role === "admin")
// solo entra si tiene el permiso "contabilidad" explícitamente concedido — igual
// que ya se exige en el frontend (ver app.js, sección "contabilidad"). El apoyo
// de un Cliente nunca pasa este filtro.
function requireContabilidad(req, res, next) {
  const u = req.user;
  const isAdmin = u.role === "admin";
  const isApoyoAdmin = u.role === "apoyo" && u.parent_role === "admin"
    && Array.isArray(u.permissions) && u.permissions.includes("contabilidad");
  if (!isAdmin && !isApoyoAdmin) return res.status(403).json({ error: "No autorizado" });
  next();
}
router.use(requireContabilidad);

const MAX_ARCHIVO_BYTES = 8 * 1024 * 1024; // ~8MB en bruto (el base64 pesa ~33% más)

// ── Cuentas bancarias ──────────────────────────────────────────
router.get("/cuentas", async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT id, nombre, saldo_inicial, created_at FROM contabilidad_cuentas WHERE user_id = $1 AND active = true ORDER BY nombre ASC",
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/cuentas", async (req, res) => {
  const { nombre, saldo_inicial } = req.body || {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: "El nombre de la cuenta es obligatorio" });
  try {
    const row = await db.get(
      `INSERT INTO contabilidad_cuentas (user_id, nombre, saldo_inicial) VALUES ($1, $2, $3)
       RETURNING id, nombre, saldo_inicial, created_at`,
      [req.user.id, String(nombre).trim(), Number(saldo_inicial) || 0]
    );
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/cuentas/:id", async (req, res) => {
  const { nombre, saldo_inicial } = req.body || {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: "El nombre de la cuenta es obligatorio" });
  try {
    const row = await db.get(
      `UPDATE contabilidad_cuentas SET nombre = $1, saldo_inicial = $2
       WHERE id = $3 AND user_id = $4
       RETURNING id, nombre, saldo_inicial, created_at`,
      [String(nombre).trim(), Number(saldo_inicial) || 0, req.params.id, req.user.id]
    );
    if (!row) return res.status(404).json({ error: "Cuenta no encontrada" });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/cuentas/:id", async (req, res) => {
  try {
    const row = await db.get(
      "UPDATE contabilidad_cuentas SET active = false WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id]
    );
    if (!row) return res.status(404).json({ error: "Cuenta no encontrada" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Movimientos de un mes concreto ─────────────────────────────
// Devuelve el saldo justo antes del día 1 del mes pedido (saldo_inicial de la
// cuenta + todo lo anterior a ese mes) y los movimientos de ese mes, para que
// el frontend calcule el saldo acumulado día a día.
router.get("/mes", async (req, res) => {
  const cuentaId = parseInt(req.query.cuenta_id);
  const year = parseInt(req.query.year);
  const month = parseInt(req.query.month); // 1-12
  if (!cuentaId || !year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }
  try {
    const cuenta = await db.get(
      "SELECT id, nombre, saldo_inicial FROM contabilidad_cuentas WHERE id = $1 AND user_id = $2 AND active = true",
      [cuentaId, req.user.id]
    );
    if (!cuenta) return res.status(404).json({ error: "Cuenta no encontrada" });

    // fecha se guarda como TEXT "YYYY-MM-DD": la comparación lexicográfica de
    // strings coincide con el orden cronológico en ese formato, así que no
    // hace falta castear a date (y así evitamos el desfase de zona horaria
    // que node-postgres introduce al leer columnas DATE reales).
    const inicioMes = `${year}-${String(month).padStart(2, "0")}-01`;
    const finMesExclusivo = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const prevRow = await db.get(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0) AS neto
       FROM contabilidad_movimientos
       WHERE cuenta_id = $1 AND fecha < $2`,
      [cuentaId, inicioMes]
    );
    const saldoAntes = Number(cuenta.saldo_inicial) + Number(prevRow?.neto || 0);

    const movimientos = await db.all(
      `SELECT id, fecha, tipo, monto, descripcion, archivo_nombre,
              (archivo_data IS NOT NULL) AS tiene_archivo
       FROM contabilidad_movimientos
       WHERE cuenta_id = $1 AND fecha >= $2 AND fecha < $3
       ORDER BY fecha ASC, id ASC`,
      [cuentaId, inicioMes, finMesExclusivo]
    );

    res.json({ cuenta, saldo_antes: saldoAntes, movimientos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Crear / eliminar movimiento ─────────────────────────────────
router.post("/movimientos", async (req, res) => {
  const { cuenta_id, fecha, tipo, monto, descripcion, archivo_nombre, archivo_data } = req.body || {};
  if (!cuenta_id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || "") || !["gasto", "ingreso"].includes(tipo) || !(Number(monto) > 0)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  if (archivo_data && archivo_data.length > MAX_ARCHIVO_BYTES * 1.4) {
    return res.status(400).json({ error: "El archivo es demasiado grande (máx ~8MB)" });
  }
  try {
    const cuenta = await db.get(
      "SELECT id FROM contabilidad_cuentas WHERE id = $1 AND user_id = $2 AND active = true",
      [cuenta_id, req.user.id]
    );
    if (!cuenta) return res.status(404).json({ error: "Cuenta no encontrada" });

    const row = await db.get(
      `INSERT INTO contabilidad_movimientos (user_id, cuenta_id, fecha, tipo, monto, descripcion, archivo_nombre, archivo_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, fecha, tipo, monto, descripcion, archivo_nombre, (archivo_data IS NOT NULL) AS tiene_archivo`,
      [req.user.id, cuenta_id, fecha, tipo, Number(monto), descripcion || null, archivo_nombre || null, archivo_data || null]
    );
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/movimientos/:id", async (req, res) => {
  try {
    const row = await db.get(
      "DELETE FROM contabilidad_movimientos WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id]
    );
    if (!row) return res.status(404).json({ error: "Movimiento no encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/contabilidad/movimientos/:id/archivo — descarga/visualización bajo demanda
// (no se manda con el listado del mes para no inflar esa respuesta).
router.get("/movimientos/:id/archivo", async (req, res) => {
  try {
    const row = await db.get(
      "SELECT archivo_nombre, archivo_data FROM contabilidad_movimientos WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!row || !row.archivo_data) return res.status(404).json({ error: "Sin archivo" });
    res.json({ nombre: row.archivo_nombre, data: row.archivo_data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
