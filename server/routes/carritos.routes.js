const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

// Orden del embudo: cada evento nuevo solo "sube" el estado, nunca lo baja
// (si alguien vuelve a ver páginas después de meter algo al carrito, sigue
// contando como "carrito" hasta que avance o se le pierda el rastro).
const ESTADO_ORDEN = { visita: 1, carrito: 2, pago_iniciado: 3, compra: 4 };

// POST /api/carritos/evento — endpoint PÚBLICO (sin auth): lo llama el pixel
// que corre en el navegador de cada visitante anónimo de la tienda, no un
// usuario logueado de PROFITCOD. Se valida shopDomain contra tiendas
// realmente conectadas para no aceptar basura de dominios ajenos.
router.post("/evento", async (req, res) => {
  const { shopDomain, tipo, clientId } = req.body || {};
  const orden = ESTADO_ORDEN[tipo];
  if (!shopDomain || !clientId || !orden) return res.status(400).json({ error: "Datos inválidos" });

  try {
    const shop = await db.get("SELECT id FROM shops WHERE shop_domain = $1 AND status = 'active'", [String(shopDomain).toLowerCase()]);
    if (!shop) return res.status(404).json({ error: "Tienda no reconocida" });

    await db.run(
      `INSERT INTO carritos_sesiones (shop_domain, client_id, estado, estado_orden, last_seen)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (shop_domain, client_id) DO UPDATE SET
         last_seen = now(),
         estado = CASE WHEN $4 >= carritos_sesiones.estado_orden THEN $3 ELSE carritos_sesiones.estado END,
         estado_orden = GREATEST(carritos_sesiones.estado_orden, $4)`,
      [String(shopDomain).toLowerCase(), String(clientId).slice(0, 200), tipo, orden]
    );

    // Limpieza oportunista de sesiones viejas (sin cron aparte): 1 de cada
    // ~200 eventos purga lo anterior a 3 días, para que la tabla no crezca
    // sin límite con cada visitante nuevo que pasa por la tienda.
    if (Math.random() < 0.005) {
      db.run("DELETE FROM carritos_sesiones WHERE last_seen < now() - interval '3 days'").catch(() => {});
    }

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/carritos/resumen — autenticado, exclusivo de la cuenta Administrador
// (igual que la sección en el frontend). Devuelve las 7 cifras por cada
// tienda conectada del admin.
router.get("/resumen", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "No autorizado" });
  try {
    const shops = await db.all(
      "SELECT id, shop_domain, shop_name FROM shops WHERE user_id = $1 AND status = 'active' ORDER BY shop_name ASC",
      [req.user.id]
    );
    if (!shops.length) return res.json([]);

    const resultado = [];
    for (const shop of shops) {
      const hoy = await db.get(
        `SELECT COUNT(*)::int AS pedidos, COALESCE(SUM(total_price), 0) AS ventas
         FROM orders
         WHERE shop_id = $1
           AND (created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date = (now() AT TIME ZONE 'Europe/Madrid')::date`,
        [shop.id]
      );
      // Moneda real de la tienda (la del pedido más reciente) en vez de
      // asumir EUR — algunas tiendas facturan en USD u otra divisa.
      const monedaRow = await db.get(
        "SELECT currency FROM orders WHERE shop_id = $1 AND currency IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        [shop.id]
      );
      const sesionesHoy = await db.get(
        `SELECT COUNT(DISTINCT client_id)::int AS n FROM carritos_sesiones
         WHERE shop_domain = $1 AND (last_seen AT TIME ZONE 'Europe/Madrid')::date = (now() AT TIME ZONE 'Europe/Madrid')::date`,
        [shop.shop_domain]
      );
      const ahora = await db.get(
        `SELECT
           COUNT(DISTINCT client_id) FILTER (WHERE last_seen > now() - interval '5 minutes')::int AS visitantes_ahora,
           COUNT(DISTINCT client_id) FILTER (WHERE estado = 'carrito' AND last_seen > now() - interval '30 minutes')::int AS carritos_activos,
           COUNT(DISTINCT client_id) FILTER (WHERE estado = 'pago_iniciado' AND last_seen > now() - interval '30 minutes')::int AS en_pago,
           COUNT(DISTINCT client_id) FILTER (WHERE estado = 'compra' AND last_seen > now() - interval '30 minutes')::int AS compras_recientes
         FROM carritos_sesiones WHERE shop_domain = $1`,
        [shop.shop_domain]
      );

      resultado.push({
        shop_id: shop.id,
        shop_domain: shop.shop_domain,
        shop_name: shop.shop_name || shop.shop_domain,
        moneda: monedaRow?.currency || "EUR",
        visitantes_ahora: ahora?.visitantes_ahora || 0,
        ventas_totales: Number(hoy?.ventas || 0),
        sesiones: sesionesHoy?.n || 0,
        pedidos: hoy?.pedidos || 0,
        carritos_activos: ahora?.carritos_activos || 0,
        en_pago: ahora?.en_pago || 0,
        compras_realizadas: ahora?.compras_recientes || 0,
      });
    }

    res.json(resultado);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
