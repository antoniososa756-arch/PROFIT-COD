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

    // archivos va como array [{id,nombre}] por movimiento (sin el contenido,
    // que se pide aparte bajo demanda) para poder listar/descargar/eliminar
    // cada adjunto por separado sin inflar esta respuesta.
    const movimientos = await db.all(
      `SELECT m.id, m.fecha, m.tipo, m.monto, m.descripcion,
              COALESCE(
                json_agg(json_build_object('id', a.id, 'nombre', a.nombre) ORDER BY a.id)
                  FILTER (WHERE a.id IS NOT NULL),
                '[]'
              ) AS archivos
       FROM contabilidad_movimientos m
       LEFT JOIN contabilidad_movimiento_archivos a ON a.movimiento_id = m.id
       WHERE m.cuenta_id = $1 AND m.fecha >= $2 AND m.fecha < $3
       GROUP BY m.id
       ORDER BY m.fecha ASC, m.id ASC`,
      [cuentaId, inicioMes, finMesExclusivo]
    );

    res.json({ cuenta, saldo_antes: saldoAntes, movimientos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const MAX_ARCHIVOS_POR_MOVIMIENTO = 10;

function validarArchivos(archivos) {
  if (!Array.isArray(archivos)) return "Formato de archivos inválido";
  if (archivos.length > MAX_ARCHIVOS_POR_MOVIMIENTO) return `Máximo ${MAX_ARCHIVOS_POR_MOVIMIENTO} archivos por movimiento`;
  for (const a of archivos) {
    if (!a?.data) return "Falta el contenido de un archivo";
    if (a.data.length > MAX_ARCHIVO_BYTES * 1.4) return "Un archivo es demasiado grande (máx ~8MB)";
  }
  return null;
}

async function insertarArchivos(userId, movimientoId, archivos) {
  if (!archivos || !archivos.length) return [];
  const nombres = archivos.map(a => (a.nombre ? String(a.nombre).slice(0, 300) : null));
  const datas   = archivos.map(a => a.data);
  return db.all(
    `INSERT INTO contabilidad_movimiento_archivos (movimiento_id, user_id, nombre, data)
     SELECT $1, $2, n, d FROM UNNEST($3::text[], $4::text[]) AS u(n, d)
     RETURNING id, nombre`,
    [movimientoId, userId, nombres, datas]
  );
}

// ── Crear / eliminar movimiento ─────────────────────────────────
// archivos: [{nombre, data}] — opcional, 0 o varios de una vez al crear.
router.post("/movimientos", async (req, res) => {
  const { cuenta_id, fecha, tipo, monto, descripcion, archivos } = req.body || {};
  if (!cuenta_id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || "") || !["gasto", "ingreso"].includes(tipo) || !(Number(monto) > 0)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const errArchivos = archivos ? validarArchivos(archivos) : null;
  if (errArchivos) return res.status(400).json({ error: errArchivos });
  try {
    const cuenta = await db.get(
      "SELECT id FROM contabilidad_cuentas WHERE id = $1 AND user_id = $2 AND active = true",
      [cuenta_id, req.user.id]
    );
    if (!cuenta) return res.status(404).json({ error: "Cuenta no encontrada" });

    const mov = await db.get(
      `INSERT INTO contabilidad_movimientos (user_id, cuenta_id, fecha, tipo, monto, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, fecha, tipo, monto, descripcion`,
      [req.user.id, cuenta_id, fecha, tipo, Number(monto), descripcion || null]
    );
    const archivosCreados = await insertarArchivos(req.user.id, mov.id, archivos);
    res.json({ ...mov, archivos: archivosCreados });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Importación masiva desde extracto bancario (CSV) ────────────
// El parseo del CSV se hace en el navegador (distintos bancos = distintas
// columnas); aquí solo se validan e insertan/corrigen movimientos ya
// normalizados. external_id es el id de transacción del banco: permite
// reimportar el mismo extracto (o uno que solape fechas, o uno corregido
// tras un ajuste en la logica de mapeo) sin duplicar — y en vez de ignorar
// silenciosamente lo que ya existía, lo CORRIGE (fecha/tipo/monto/descripción)
// por si el mapeo cambió y el importe cargado antes ya no era el correcto.
// archivo_nombre/archivo_data se dejan fuera del UPDATE a propósito: si el
// usuario ya adjuntó una factura a mano, reimportar no debe borrarla.
const MAX_BULK_ROWS = 5000;
router.post("/movimientos/bulk", async (req, res) => {
  const { cuenta_id, movimientos } = req.body || {};
  if (!cuenta_id || !Array.isArray(movimientos) || !movimientos.length) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  if (movimientos.length > MAX_BULK_ROWS) {
    return res.status(400).json({ error: `Demasiadas filas (máx ${MAX_BULK_ROWS} por importación)` });
  }
  try {
    const cuenta = await db.get(
      "SELECT id FROM contabilidad_cuentas WHERE id = $1 AND user_id = $2 AND active = true",
      [cuenta_id, req.user.id]
    );
    if (!cuenta) return res.status(404).json({ error: "Cuenta no encontrada" });

    const validas = movimientos.filter(m =>
      /^\d{4}-\d{2}-\d{2}$/.test(m?.fecha || "") && ["gasto", "ingreso"].includes(m?.tipo) && Number(m?.monto) > 0
    );
    const invalidos = movimientos.length - validas.length;
    if (!validas.length) return res.json({ ok: true, insertados: 0, actualizados: 0, invalidos, total: movimientos.length });

    const fechas   = validas.map(m => m.fecha);
    const tipos    = validas.map(m => m.tipo);
    const montos   = validas.map(m => Number(m.monto));
    const descs    = validas.map(m => (m.descripcion ? String(m.descripcion).slice(0, 500) : null));
    const externos = validas.map(m => (m.external_id ? String(m.external_id).slice(0, 200) : null));

    // (xmax = 0) distingue insert de update en el propio RETURNING: en una fila
    // recien insertada xmax es 0; si el ON CONFLICT hizo un UPDATE, no lo es.
    const resultado = await db.all(
      `INSERT INTO contabilidad_movimientos (user_id, cuenta_id, fecha, tipo, monto, descripcion, external_id)
       SELECT $1, $2, f, t, mo, d, e
       FROM UNNEST($3::text[], $4::text[], $5::numeric[], $6::text[], $7::text[]) AS u(f, t, mo, d, e)
       ON CONFLICT (cuenta_id, external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET fecha = EXCLUDED.fecha, tipo = EXCLUDED.tipo, monto = EXCLUDED.monto, descripcion = EXCLUDED.descripcion
       RETURNING id, (xmax = 0) AS inserted`,
      [req.user.id, cuenta_id, fechas, tipos, montos, descs, externos]
    );

    const insertados = resultado.filter(r => r.inserted).length;
    res.json({
      ok: true,
      insertados,
      actualizados: resultado.length - insertados,
      invalidos,
      total: movimientos.length,
    });
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

// POST /api/contabilidad/movimientos/:id/archivos — añade uno o varios
// archivos a un movimiento que ya existe, sin tocar fecha/tipo/monto/los
// archivos que ya tuviera. Sirve tanto para adjuntar más comprobantes a mano
// como para los movimientos que llegan sin factura desde una importación
// masiva (CSV).
router.post("/movimientos/:id/archivos", async (req, res) => {
  const { archivos } = req.body || {};
  const errArchivos = validarArchivos(archivos || []);
  if (errArchivos) return res.status(400).json({ error: errArchivos });
  if (!archivos || !archivos.length) return res.status(400).json({ error: "No se recibió ningún archivo" });
  try {
    const mov = await db.get(
      "SELECT id FROM contabilidad_movimientos WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!mov) return res.status(404).json({ error: "Movimiento no encontrado" });

    const { count } = await db.get(
      "SELECT COUNT(*)::int AS count FROM contabilidad_movimiento_archivos WHERE movimiento_id = $1",
      [req.params.id]
    );
    if (count + archivos.length > MAX_ARCHIVOS_POR_MOVIMIENTO) {
      return res.status(400).json({ error: `Máximo ${MAX_ARCHIVOS_POR_MOVIMIENTO} archivos por movimiento` });
    }

    const archivosCreados = await insertarArchivos(req.user.id, req.params.id, archivos);
    res.json({ archivos: archivosCreados });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/contabilidad/movimientos/archivos/:archivoId — descarga/visualización
// bajo demanda de un archivo concreto (no se manda con el listado del mes).
router.get("/movimientos/archivos/:archivoId", async (req, res) => {
  try {
    const row = await db.get(
      "SELECT nombre, data FROM contabilidad_movimiento_archivos WHERE id = $1 AND user_id = $2",
      [req.params.archivoId, req.user.id]
    );
    if (!row) return res.status(404).json({ error: "Archivo no encontrado" });
    res.json({ nombre: row.nombre, data: row.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/contabilidad/movimientos/archivos/:archivoId — elimina un solo
// archivo sin tocar el resto de adjuntos ni el movimiento en sí.
router.delete("/movimientos/archivos/:archivoId", async (req, res) => {
  try {
    const row = await db.get(
      "DELETE FROM contabilidad_movimiento_archivos WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.archivoId, req.user.id]
    );
    if (!row) return res.status(404).json({ error: "Archivo no encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Remitentes (trabajadores/proveedores a los que se les paga) ─────────
// "Trabajadores" = las descripciones de gasto que ya existen en Contabilidad
// (el nombre del destinatario del pago), cruzadas con el perfil de
// facturación guardado para cada uno (si ya se rellenó). Así la lista sale
// sola de lo que ya se ha estado pagando, sin tener que darlos de alta a mano.
router.get("/remitentes", async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT m.descripcion AS nombre,
              COUNT(*)::int AS total_pagos,
              COUNT(*) FILTER (WHERE m.pfactura_id IS NULL)::int AS pendientes,
              COALESCE(SUM(m.monto), 0) AS total_monto,
              MAX(m.fecha) AS ultimo_pago,
              r.id AS remitente_id, r.identificacion, r.direccion, r.email, r.telefono
       FROM contabilidad_movimientos m
       LEFT JOIN contabilidad_remitentes r
         ON r.user_id = m.user_id AND LOWER(TRIM(r.nombre)) = LOWER(TRIM(m.descripcion))
       WHERE m.user_id = $1 AND m.tipo = 'gasto'
         AND m.descripcion IS NOT NULL AND TRIM(m.descripcion) <> ''
         AND m.descripcion NOT ILIKE 'Comisión bancaria%'
       GROUP BY m.descripcion, r.id, r.identificacion, r.direccion, r.email, r.telefono
       ORDER BY total_pagos DESC, m.descripcion ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/contabilidad/remitentes — crear o actualizar el perfil de
// facturación de un remitente (upsert por nombre exacto, para poder guardarlo
// tal cual aparece en las descripciones de gasto y así poder cruzarlo).
router.post("/remitentes", async (req, res) => {
  const { nombre, identificacion, direccion, email, telefono } = req.body || {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: "Falta el nombre" });
  try {
    const row = await db.get(
      `INSERT INTO contabilidad_remitentes (user_id, nombre, identificacion, direccion, email, telefono)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, nombre) DO UPDATE SET
         identificacion = EXCLUDED.identificacion, direccion = EXCLUDED.direccion,
         email = EXCLUDED.email, telefono = EXCLUDED.telefono
       RETURNING id, nombre, identificacion, direccion, email, telefono`,
      [req.user.id, String(nombre).trim(), identificacion || null, direccion || null, email || null, telefono || null]
    );
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/remitentes/:id", async (req, res) => {
  try {
    const row = await db.get(
      "DELETE FROM contabilidad_remitentes WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id]
    );
    if (!row) return res.status(404).json({ error: "Remitente no encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Datos propios (los de la cuenta) para usarlos como "cliente" de la factura:
// quien le paga al remitente es este negocio, no al revés. cliente_identificacion
// es obligatorio para que PFactura acepte la factura (validez fiscal).
async function getPropioComoCliente(userId) {
  const u = await db.get(
    "SELECT email, display_name, billing_name, billing_nif, billing_address, billing_city, billing_country FROM users WHERE id = $1",
    [userId]
  );
  return {
    nombre: u?.billing_name || u?.display_name || u?.email || "",
    identificacion: u?.billing_nif || "",
    direccion1: u?.billing_address || null,
    ciudad: u?.billing_city || null,
    pais: u?.billing_country || null,
    email: u?.email || null,
  };
}

// POST /api/contabilidad/remitentes/generar-facturas — crea en PFactura una
// factura por cada gasto de este remitente que todavía no tenga una (fecha =
// fecha del gasto, importe = su monto, pagado = importe completo porque el
// gasto ya refleja un pago hecho). Se crean como registro normal de PFactura,
// NUNCA se genera/descarga el PDF aquí — quedan listas para que el admin las
// abra y edite las observaciones antes de generar el PDF cuando quiera.
router.post("/remitentes/generar-facturas", async (req, res) => {
  const { nombre } = req.body || {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: "Falta el nombre del remitente" });
  const nombreTrim = String(nombre).trim();
  try {
    const remitente = await db.get(
      "SELECT * FROM contabilidad_remitentes WHERE user_id = $1 AND LOWER(TRIM(nombre)) = LOWER($2)",
      [req.user.id, nombreTrim]
    );
    if (!remitente) return res.status(400).json({ error: "Primero guarda los datos de facturación de este trabajador" });

    const cliente = await getPropioComoCliente(req.user.id);
    if (!cliente.identificacion) {
      return res.status(400).json({ error: "Completa tu NIF/CIF en Perfil antes de generar facturas (es obligatorio para que la factura sea válida)" });
    }

    const pendientes = await db.all(
      `SELECT id, fecha, monto FROM contabilidad_movimientos
       WHERE user_id = $1 AND tipo = 'gasto' AND pfactura_id IS NULL
         AND LOWER(TRIM(descripcion)) = LOWER($2)
       ORDER BY fecha ASC, id ASC`,
      [req.user.id, nombreTrim]
    );
    if (!pendientes.length) return res.json({ creadas: 0, facturas: [] });

    const facturas = [];
    for (const mov of pendientes) {
      const seqRow = await db.get(
        "UPDATE users SET pfactura_seq = pfactura_seq + 1 WHERE id = $1 RETURNING pfactura_seq",
        [req.user.id]
      );
      const numero = `INV-${String(seqRow.pfactura_seq).padStart(6, "0")}`;

      const factura = await db.get(
        `INSERT INTO pfacturas (
           user_id, numero, fecha, cliente_nombre, pagado,
           emisor_nombre, emisor_identificacion, emisor_direccion, emisor_email,
           cliente_identificacion, cliente_email, cliente_direccion1, cliente_ciudad, cliente_pais
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id, numero`,
        [
          req.user.id, numero, mov.fecha, cliente.nombre, Number(mov.monto),
          remitente.nombre, remitente.identificacion || null, remitente.direccion || null, remitente.email || null,
          cliente.identificacion, cliente.email, cliente.direccion1, cliente.ciudad, cliente.pais,
        ]
      );
      await db.run(
        "INSERT INTO pfactura_items (pfactura_id, descripcion, cantidad, precio, orden) VALUES ($1, $2, 1, $3, 0)",
        [factura.id, "Servicio", Number(mov.monto)]
      );
      await db.run("UPDATE contabilidad_movimientos SET pfactura_id = $1 WHERE id = $2", [factura.id, mov.id]);

      facturas.push({ id: factura.id, numero: factura.numero, movimiento_id: mov.id, fecha: mov.fecha, monto: Number(mov.monto) });
    }

    res.json({ creadas: facturas.length, facturas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
