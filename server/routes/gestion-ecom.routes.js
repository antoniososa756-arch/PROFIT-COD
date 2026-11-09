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

const soloAdmin = (req, res, next) =>
  req.user?.role === "admin" ? next() : res.status(403).json({ error: "Solo administradores" });

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
              o.estado_cambiado_at, o.franquicia_desde, o.mrw_history_json,
              COALESCE(o.shop_domain, s.shop_domain) AS shop_domain,
              COALESCE(o.customer_phone, '') AS telefono
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE (o.shop_id IN (SELECT id FROM shops WHERE user_id = $1)
              OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
         AND o.fulfillment_status = 'franquicia'
         AND o.cancelled_at IS NULL
       LIMIT 500`,
      [req.user.id]
    );
    // Desde cuándo está en franquicia: lo calculado por el cron MRW; si aún
    // no, el historial guardado; si no, cuándo ProfitCOD vio el cambio.
    const { franquiciaDesde } = require("../franquicia");
    for (const r of rows) {
      let desde = r.franquicia_desde;
      if (!desde && r.mrw_history_json) { try { desde = franquiciaDesde(JSON.parse(r.mrw_history_json)); } catch (e) {} }
      if (!desde && r.estado_cambiado_at) desde = String(r.estado_cambiado_at).slice(0, 10);
      r.franquicia_desde = desde || null;
      delete r.mrw_history_json;
    }
    // Primero los que más días llevan en franquicia
    rows.sort((a, b) => String(a.franquicia_desde || "9999").localeCompare(String(b.franquicia_desde || "9999")));
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

module.exports = router;
