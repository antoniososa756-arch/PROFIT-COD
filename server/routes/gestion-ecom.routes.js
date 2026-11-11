// Gestión Ecom (de momento solo administrador): confirmación de pedidos.
// "Confirmar pedidos" lista los pedidos que aún NO llevan la etiqueta con la
// que el almacén prepara los envíos (la escribe el usuario, p.ej. "fulfio").
// Tampoco salen los que ya llevan "correcto": a veces el almacén quita la
// etiqueta de confirmación y pone "correcto", y esos ya están confirmados.
const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

const ETIQUETA_YA_REVISADO = "correcto";
const DIAS = 30; // solo pedidos recientes

// Gestión Ecom está abierta a todas las cuentas. Las de apoyo trabajan con
// los datos de su cuenta principal (auth.js cambia req.user.id por el del
// padre) y solo entran si tienen el permiso "gestion-ecom" (sin lista de
// permisos = acceso completo, igual que en el menú).
const soloAdmin = (req, res, next) => {
  if (req.user?.role !== "apoyo") return next();
  const p = req.user.permissions;
  if (!Array.isArray(p) || p.includes("gestion-ecom")) return next();
  return res.status(403).json({ error: "Sin permiso para Gestión Ecom" });
};

// GET /api/gestion-ecom/config -> { etiqueta }
router.get("/config", auth, soloAdmin, async (req, res) => {
  try {
    const r = await db.get("SELECT ge_etiqueta FROM users WHERE id = $1", [req.user.id]);
    res.json({ etiqueta: r?.ge_etiqueta || "" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/gestion-ecom/config { etiqueta }
router.put("/config", auth, soloAdmin, async (req, res) => {
  const etiqueta = String(req.body?.etiqueta || "").trim().slice(0, 100);
  try {
    await db.run("UPDATE users SET ge_etiqueta = $1 WHERE id = $2", [etiqueta || null, req.user.id]);
    res.json({ ok: true, etiqueta });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gestion-ecom/confirmar -> pedidos sin la etiqueta del almacén
// (ni "correcto"), sin cancelar, sin enviar todavía y de los últimos 30 días.
router.get("/confirmar", auth, soloAdmin, async (req, res) => {
  try {
    const cfg = await db.get("SELECT ge_etiqueta FROM users WHERE id = $1", [req.user.id]);
    const etiqueta = (cfg?.ge_etiqueta || "").trim().toLowerCase();
    if (!etiqueta) return res.json({ etiqueta: "", pedidos: [] });
    const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000).toISOString();
    const rows = await db.all(
      `SELECT o.id, o.order_number, o.created_at, o.customer_name, o.total_price, o.currency,
              o.financial_status, o.note,
              COALESCE(o.shop_domain, s.shop_domain) AS shop_domain,
              COALESCE(o.customer_phone, '') AS telefono,
              -- tal cual se escribieron (ACEPTAR, Aceptar...); el filtro usa profit_tags
              COALESCE(substring(o.raw_json from '"tags":"([^"]*)"'), '') AS etiquetas
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE (o.shop_id IN (SELECT id FROM shops WHERE user_id = $1)
              OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
         AND o.created_at >= $2
         AND o.cancelled_at IS NULL
         AND COALESCE(o.fulfillment_status, '') NOT IN ('cancelado','entregado','devuelto','destruido')
         AND (o.tracking_number IS NULL OR o.tracking_number = '')
         -- Archivados en Shopify (closed_at con fecha): ya gestionados, fuera
         AND COALESCE(o.raw_json, '') !~ '"closed_at":"'
         AND NOT (profit_tags(o.raw_json) && ARRAY[$3, $4]::text[])
       ORDER BY o.created_at DESC
       LIMIT 300`,
      [req.user.id, desde, etiqueta, ETIQUETA_YA_REVISADO]
    );
    res.json({ etiqueta, pedidos: rows });
  } catch (e) {
    console.error("[GestionEcom] confirmar:", e.message);
    res.status(500).json({ error: "Error cargando los pedidos" });
  }
});

// GET /api/gestion-ecom/franquicia -> pedidos que están ahora mismo en
// franquicia (estado que ProfitCOD detecta con MRW/CTT), de todas las
// tiendas. Primero los que más tiempo llevan allí.
router.get("/franquicia", auth, soloAdmin, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT o.id, o.order_number, o.created_at, o.customer_name, o.total_price, o.currency,
              o.note, o.tracking_number, o.carrier, o.mrw_estado_texto,
              o.estado_cambiado_at, o.envio_desde, o.mrw_history_json,
              COALESCE(o.shop_domain, s.shop_domain) AS shop_domain,
              COALESCE(o.customer_phone, '') AS telefono
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE (o.shop_id IN (SELECT id FROM shops WHERE user_id = $1)
              OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
         AND o.fulfillment_status = 'franquicia'
         -- Solo MRW (las incidencias se gestionan con MRW)
         AND (o.carrier = 'mrw' OR (o.carrier IS NULL AND btrim(o.tracking_number) ~ '^[0-9]{5}[A-Za-z][0-9]{6}$'))
         AND o.cancelled_at IS NULL
       LIMIT 500`,
      [req.user.id]
    );
    // Desde cuándo está en camino (salida del paquete = primer movimiento del
    // seguimiento): lo guardado por el cron MRW; si aún no, el historial
    // guardado; si no, la fecha del pedido.
    const { inicioEnvio } = require("../franquicia");
    for (const r of rows) {
      let desde = r.envio_desde;
      if (!desde && r.mrw_history_json) { try { desde = inicioEnvio(JSON.parse(r.mrw_history_json)); } catch (e) {} }
      r.envio_aproximado = !desde;
      if (!desde && r.created_at) desde = new Date(r.created_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
      r.envio_desde = desde || null;
      delete r.mrw_history_json;
    }
    // Primero los que más días llevan en camino
    rows.sort((a, b) => String(a.envio_desde || "9999").localeCompare(String(b.envio_desde || "9999")));
    res.json({ pedidos: rows });
  } catch (e) {
    console.error("[GestionEcom] franquicia:", e.message);
    res.status(500).json({ error: "Error cargando los pedidos en franquicia" });
  }
});

// POST /api/gestion-ecom/confirmar/:id — confirma el pedido: le añade en
// Shopify la etiqueta del almacén (p.ej. "fulfio") conservando las que ya
// tenga. Las etiquetas se leen de Shopify en ese momento (no de la copia
// local) para no borrar ninguna que se haya puesto desde el último sync.
router.post("/confirmar/:id", auth, soloAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });
  try {
    const cfg = await db.get("SELECT ge_etiqueta FROM users WHERE id = $1", [req.user.id]);
    const etiqueta = (cfg?.ge_etiqueta || "").trim();
    if (!etiqueta) return res.status(400).json({ error: "Primero guarda la etiqueta de tu almacén" });

    const row = await db.get(
      `SELECT o.order_id, o.order_number, COALESCE(o.shop_domain, s.shop_domain) AS shop_domain
       FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
       WHERE o.id = $1
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $2)
              OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2))`,
      [id, req.user.id]
    );
    if (!row) return res.status(404).json({ error: "Pedido no encontrado" });
    const shopRow = await db.get("SELECT access_token FROM shops WHERE shop_domain = $1 AND user_id = $2", [row.shop_domain, req.user.id]);
    if (!shopRow) return res.status(404).json({ error: "Tienda no encontrada" });
    const H = { "Content-Type": "application/json", "X-Shopify-Access-Token": shopRow.access_token };
    const url = `https://${row.shop_domain}/admin/api/2024-10/orders/${row.order_id}.json`;

    const actual = await fetch(`${url}?fields=id,tags`, { headers: H });
    if (!actual.ok) return res.status(502).json({ error: "No se pudo leer el pedido en Shopify" });
    const tags = String((await actual.json()).order?.tags || "").split(",").map(t => t.trim()).filter(Boolean);
    if (!tags.some(t => t.toLowerCase() === etiqueta.toLowerCase())) tags.push(etiqueta);

    const r = await fetch(url, { method: "PUT", headers: H, body: JSON.stringify({ order: { id: parseInt(row.order_id), tags: tags.join(", ") } }) });
    if (!r.ok) {
      console.error("[GestionEcom] confirmar Shopify:", r.status, await r.text());
      return res.status(502).json({ error: "Shopify no aceptó la etiqueta" });
    }
    const data = await r.json();
    if (data.order) await db.run("UPDATE orders SET raw_json = $1 WHERE id = $2", [JSON.stringify(data.order), id]);
    res.json({ ok: true, etiqueta, order_number: row.order_number });
  } catch (e) {
    console.error("[GestionEcom] confirmar:", e.message);
    res.status(500).json({ error: "Error confirmando el pedido" });
  }
});

// Anchos de los 3 bloques del pedido abierto desde Incidencias, guardados en
// la cuenta (así se mantienen entre días y ordenadores).
router.get("/columnas", auth, soloAdmin, async (req, res) => {
  try {
    const r = await db.get("SELECT ge_columnas FROM users WHERE id = $1", [req.user.id]);
    let columnas = null;
    try { columnas = r?.ge_columnas ? JSON.parse(r.ge_columnas) : null; } catch (e) {}
    res.json({ columnas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put("/columnas", auth, soloAdmin, async (req, res) => {
  const c = req.body?.columnas;
  if (!Array.isArray(c) || c.length !== 3 || !c.every(x => Number.isFinite(x) && x > 0 && x < 100)) {
    return res.status(400).json({ error: "Anchos no válidos" });
  }
  try {
    await db.run("UPDATE users SET ge_columnas = $1 WHERE id = $2", [JSON.stringify(c.map(x => Math.round(x * 1000) / 1000)), req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Incidencias MRW por correo (ver server/incidencias-mrw.js) ──────────────
const inc = require("../incidencias-mrw");

// GET /api/gestion-ecom/incidencias/config
router.get("/incidencias/config", auth, soloAdmin, async (req, res) => {
  try {
    await inc.ensureTablas();
    const c = await db.get("SELECT remitente, email, last_sync, last_result FROM incidencias_mrw_config WHERE user_id = $1", [req.user.id]);
    let last_result = null;
    try { last_result = c?.last_result ? JSON.parse(c.last_result) : null; } catch (e) {}
    res.json({ configurado: !!c, remitente: c?.remitente || "", email: c?.email || "", last_sync: c?.last_sync || null, last_result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/gestion-ecom/incidencias/config { remitente, email, password }
// Prueba la conexión con Gmail antes de guardar. La contraseña es opcional
// si ya había una guardada (para cambiar solo el remitente).
router.put("/incidencias/config", auth, soloAdmin, async (req, res) => {
  const remitente = String(req.body?.remitente || "").trim().toLowerCase();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "").replace(/\s+/g, "");
  if (!/^[^@\s]+@[^@\s]+$/.test(remitente)) return res.status(400).json({ error: "Indica el correo que envía las incidencias" });
  if (!/^[^@\s]+@(gmail|googlemail)\.com$/.test(email)) return res.status(400).json({ error: "El correo donde recibes las incidencias debe ser de Gmail (@gmail.com)" });
  try {
    await inc.ensureTablas();
    const previa = await db.get("SELECT email, password_enc FROM incidencias_mrw_config WHERE user_id = $1", [req.user.id]);
    let pass = password;
    if (!pass && previa && previa.email === email) pass = inc.descifrar(previa.password_enc);
    if (!pass) return res.status(400).json({ error: "Indica la contraseña de aplicación de Gmail" });
    try { await inc.probarConexion(email, pass); }
    catch (e) { return res.status(400).json({ error: "Gmail no aceptó el correo o la contraseña de aplicación. Revisa que sea la contraseña de aplicación (16 letras), no la de la cuenta." }); }
    // Buzón o remitente nuevos: volver a leer los últimos 15 días
    const cambiaBuzon = !previa || previa.email !== email;
    await db.run(
      `INSERT INTO incidencias_mrw_config (user_id, remitente, email, password_enc) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET remitente = EXCLUDED.remitente, email = EXCLUDED.email, password_enc = EXCLUDED.password_enc,
         ultimo_uid = CASE WHEN $5::boolean OR incidencias_mrw_config.remitente <> EXCLUDED.remitente THEN 0 ELSE incidencias_mrw_config.ultimo_uid END`,
      [req.user.id, remitente, email, inc.cifrar(pass), cambiaBuzon]
    );
    // La primera lectura (15 días) puede tardar: se hace en segundo plano
    inc.sincronizarUsuario(req.user.id).catch(() => {});
    res.json({ ok: true, leyendo: true });
  } catch (e) {
    console.error("[GestionEcom] incidencias config:", e.message);
    res.status(500).json({ error: "Error guardando la configuración" });
  }
});

// POST /api/gestion-ecom/incidencias/sincronizar -> leer correos ahora
router.post("/incidencias/sincronizar", auth, soloAdmin, async (req, res) => {
  try { res.json(await inc.sincronizarUsuario(req.user.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gestion-ecom/incidencias?estado=abiertas|resueltas
router.get("/incidencias", auth, soloAdmin, async (req, res) => {
  try {
    await inc.ensureTablas();
    const resueltas = req.query.estado === "resueltas";
    // Incidencias sin pedido: volver a buscarlo por el nº de seguimiento (el
    // aviso de MRW pudo llegar antes de que el pedido se sincronizara)
    await db.run(
      `UPDATE incidencias_mrw i SET order_id = o.id
       FROM orders o
       WHERE i.user_id = $1 AND i.order_id IS NULL AND btrim(o.tracking_number) = i.envio
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $1)
              OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))`,
      [req.user.id]
    ).catch(() => {});
    const rows = await db.all(
      `SELECT i.id, i.envio, i.order_id, i.referencia, i.tipo, i.destinatario, i.telefono, i.direccion,
              i.fecha_anomalia, i.estado, i.mrw_escribio, i.ultimo_mensaje_at, i.created_at,
              o.order_number, o.customer_name, o.total_price, o.currency, o.fulfillment_status, o.note, o.created_at AS pedido_created_at,
              COALESCE(o.customer_phone, '') AS telefono_pedido,
              COALESCE(o.shop_domain, s.shop_domain) AS shop_domain,
              (SELECT COUNT(*) FROM incidencias_mrw_mensajes m WHERE m.incidencia_id = i.id) AS n_mensajes
       FROM incidencias_mrw i
       LEFT JOIN orders o ON o.id = i.order_id
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE i.user_id = $1 AND ${resueltas ? "i.estado = 'resuelta'" : "i.estado <> 'resuelta'"}
       ORDER BY i.mrw_escribio DESC, i.ultimo_mensaje_at DESC
       LIMIT 500`,
      [req.user.id]
    );
    res.json({ incidencias: rows });
  } catch (e) {
    console.error("[GestionEcom] incidencias:", e.message);
    res.status(500).json({ error: "Error cargando las incidencias" });
  }
});

// GET /api/gestion-ecom/incidencias/:id/mensajes -> hilo de correos
router.get("/incidencias/:id/mensajes", auth, soloAdmin, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT m.id, m.de, m.asunto, m.texto, m.fecha, m.manual, m.saliente
       FROM incidencias_mrw_mensajes m JOIN incidencias_mrw i ON i.id = m.incidencia_id
       WHERE i.id = $1 AND i.user_id = $2 ORDER BY m.fecha ASC`,
      [parseInt(req.params.id), req.user.id]
    );
    res.json({ mensajes: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gestion-ecom/sin-actualizar -> pedidos de MRW en tránsito/franquicia
// (o enviados sin movimiento) de los últimos 2 meses y con fecha de hasta
// hace 3 días hábiles (sin contar sábados ni domingos): los que MRW no mueve
// ni avisa y hay que reclamar nosotros. Incluye el estado de su conversación.
router.get("/sin-actualizar", auth, soloAdmin, async (req, res) => {
  try {
    await inc.ensureTablas();
    const hoy = new Date(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) + "T12:00:00Z");
    let d = new Date(hoy), habiles = 0;
    while (habiles < 3) { d.setUTCDate(d.getUTCDate() - 1); const dia = d.getUTCDay(); if (dia !== 0 && dia !== 6) habiles++; }
    const hasta = d.toISOString().slice(0, 10);
    const desde = new Date(hoy.getTime() - 61 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await db.all(
      `SELECT o.id, o.order_number, o.created_at, o.customer_name, o.total_price, o.currency, o.note,
              o.tracking_number, o.fulfillment_status, o.mrw_estado_texto,
              COALESCE(o.shop_domain, s.shop_domain) AS shop_domain,
              COALESCE(o.customer_phone, '') AS telefono,
              i.estado AS inc_estado, i.mrw_escribio AS inc_mrw_escribio,
              (SELECT COUNT(*) FROM incidencias_mrw_mensajes m WHERE m.incidencia_id = i.id AND m.saliente) AS inc_enviados
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       LEFT JOIN incidencias_mrw i ON i.user_id = $1 AND i.envio = btrim(o.tracking_number)
       WHERE (o.shop_id IN (SELECT id FROM shops WHERE user_id = $1)
              OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
         -- Solo MRW: agencia MRW o, sin agencia guardada, nº con formato MRW (04700F778981)
         AND (o.carrier = 'mrw' OR (o.carrier IS NULL AND btrim(o.tracking_number) ~ '^[0-9]{5}[A-Za-z][0-9]{6}$'))
         AND o.tracking_number IS NOT NULL AND btrim(o.tracking_number) <> ''
         AND o.cancelled_at IS NULL
         AND o.fulfillment_status IN ('enviado','en_transito','franquicia')
         AND o.created_at >= $2
         AND (o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date <= $3::date
       ORDER BY o.created_at ASC
       LIMIT 1000`,
      [req.user.id, desde, hasta]
    );
    res.json({ hasta, pedidos: rows });
  } catch (e) {
    console.error("[GestionEcom] sin-actualizar:", e.message);
    res.status(500).json({ error: "Error cargando los pedidos sin actualizar" });
  }
});

// POST /api/gestion-ecom/incidencias/iniciar/:orderId { texto } -> primer
// correo a MRW (asunto = nº de seguimiento)
router.post("/incidencias/iniciar/:orderId", auth, soloAdmin, async (req, res) => {
  try { res.json(await inc.iniciarConversacion(req.user.id, parseInt(req.params.orderId), req.body?.texto)); }
  catch (e) { res.status(400).json({ error: e.message || "No se pudo enviar" }); }
});

// GET /api/gestion-ecom/incidencias/por-pedido/:orderId -> la incidencia de
// ese pedido (la más reciente) con su hilo de correos, para la columna de
// correo del detalle del pedido.
router.get("/incidencias/por-pedido/:orderId", auth, soloAdmin, async (req, res) => {
  try {
    await inc.ensureTablas();
    const i = await db.get(
      `SELECT id, envio, tipo, estado, mrw_escribio, fecha_anomalia FROM incidencias_mrw
       WHERE user_id = $1 AND order_id = $2 ORDER BY ultimo_mensaje_at DESC LIMIT 1`,
      [req.user.id, parseInt(req.params.orderId)]
    );
    if (!i) {
      // Sin conversación: datos para escribir el primer correo a MRW
      const ped = await db.get("SELECT btrim(tracking_number) AS envio FROM orders WHERE id = $1", [parseInt(req.params.orderId)]);
      const c = await db.get("SELECT remitente, email FROM incidencias_mrw_config WHERE user_id = $1", [req.user.id]);
      return res.json({ incidencia: null, mensajes: [], leyendo: !!global.__incMrwEnCurso?.[req.user.id],
        envio: ped?.envio || "", remitente: c?.remitente || "", email: c?.email || "" });
    }
    const mensajes = await db.all(
      "SELECT id, de, asunto, texto, html, fecha, manual, saliente FROM incidencias_mrw_mensajes WHERE incidencia_id = $1 ORDER BY fecha ASC",
      [i.id]
    );
    const cfg = await db.get("SELECT email FROM incidencias_mrw_config WHERE user_id = $1", [req.user.id]);
    res.json({ incidencia: i, mensajes, email: cfg?.email || "" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Registro de llamadas del pedido (Notas en la vista de Incidencias) ─────
// Propio de ProfitCOD (no se sincroniza con la nota de Shopify).
router.get("/llamadas/:orderId", auth, soloAdmin, async (req, res) => {
  try {
    await inc.ensureTablas();
    const rows = await db.all(
      "SELECT id, numero, texto, autor, created_at FROM incidencias_llamadas WHERE user_id = $1 AND order_id = $2 ORDER BY numero ASC",
      [req.user.id, parseInt(req.params.orderId)]
    );
    res.json({ llamadas: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post("/llamadas/:orderId", auth, soloAdmin, async (req, res) => {
  const texto = String(req.body?.texto || "").trim().slice(0, 2000);
  if (!texto) return res.status(400).json({ error: "Escribe qué pasó en la llamada" });
  const orderId = parseInt(req.params.orderId);
  try {
    await inc.ensureTablas();
    const n = await db.get("SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM incidencias_llamadas WHERE user_id = $1 AND order_id = $2", [req.user.id, orderId]);
    // Autor: la persona que escribe (en apoyo, su propia cuenta, no la principal)
    const u = await db.get("SELECT COALESCE(NULLIF(display_name, ''), email) AS name FROM users WHERE id = $1", [req.user.own_id || req.user.id]).catch(() => null);
    await db.run(
      "INSERT INTO incidencias_llamadas (user_id, order_id, numero, texto, autor) VALUES ($1,$2,$3,$4,$5)",
      [req.user.id, orderId, n.n, texto, u?.name || null]
    );
    res.json({ ok: true, numero: n.n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete("/llamadas/:orderId/:id", auth, soloAdmin, async (req, res) => {
  try {
    await db.run("DELETE FROM incidencias_llamadas WHERE id = $1 AND user_id = $2 AND order_id = $3", [parseInt(req.params.id), req.user.id, parseInt(req.params.orderId)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gestion-ecom/incidencias/:id/responder { texto } -> correo a MRW
router.post("/incidencias/:id/responder", auth, soloAdmin, async (req, res) => {
  try {
    res.json(await inc.responder(req.user.id, parseInt(req.params.id), req.body?.texto));
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo enviar la respuesta" });
  }
});

// POST /api/gestion-ecom/incidencias/:id/estado { estado: nueva|respondida|resuelta }
router.post("/incidencias/:id/estado", auth, soloAdmin, async (req, res) => {
  const estado = String(req.body?.estado || "");
  if (!["nueva", "respondida", "resuelta"].includes(estado)) return res.status(400).json({ error: "Estado no válido" });
  try {
    const r = await db.run(
      "UPDATE incidencias_mrw SET estado = $1, mrw_escribio = CASE WHEN $1 = 'nueva' THEN mrw_escribio ELSE false END WHERE id = $2 AND user_id = $3",
      [estado, parseInt(req.params.id), req.user.id]
    );
    if (!r.changes) return res.status(404).json({ error: "Incidencia no encontrada" });
    // Resuelta en ProfitCOD -> sus correos de MRW quedan leídos en Gmail
    if (estado === "resuelta") {
      const i = await db.get("SELECT envio FROM incidencias_mrw WHERE id = $1 AND user_id = $2", [parseInt(req.params.id), req.user.id]);
      if (i?.envio) inc.marcarLeidoGmail(req.user.id, i.envio); // en segundo plano
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
