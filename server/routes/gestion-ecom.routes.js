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
              array_to_string(profit_tags(o.raw_json), ', ') AS etiquetas
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

module.exports = router;
