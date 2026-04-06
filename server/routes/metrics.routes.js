const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

// GET /api/metrics  (endpoint legacy - resumen global)
router.get("/metrics", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const row = await db.get(
      `SELECT
        COUNT(DISTINCT shops.id) AS tiendas,
        COUNT(DISTINCT orders.id) AS pedidos,
        COALESCE(SUM(orders.total_price), 0) AS facturacion
       FROM users
       LEFT JOIN shops ON shops.user_id = users.id
       LEFT JOIN orders ON orders.shop_id = shops.id
       WHERE users.id = $1`,
      [userId]
    );
    res.json({ tiendas: row?.tiendas || 0, pedidos: row?.pedidos || 0, facturacion: row?.facturacion || 0 });
  } catch (e) { res.status(500).json({ error: "Error métricas" }); }
});

// GET /api/metrics/stats
// Params: from, to, shops (coma-separado o array)
// Devuelve: conteos por estado + facturación (con lógica cancelados por fecha)
router.get("/stats", auth, async (req, res) => {
  const userId = req.user.id;
  const from   = req.query.from || null;
  const to     = req.query.to   || null;

  // shops puede venir como ?shops=a,b,c o como ?shops[]=a&shops[]=b
  let shops = req.query.shops || null;
  if (shops && typeof shops === "string") shops = shops.split(",").map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(shops) || shops.length === 0) shops = null;

  try {
    const shopSubquery = `SELECT id FROM shops WHERE user_id = $1`;
    const params = [userId];
    let i = 2;

    const dateCondFrom = from ? `AND (o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date >= $${i++}::date` : "";
    if (from) params.push(from);
    const dateCondTo = to ? `AND (o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date <= $${i++}::date` : "";
    if (to) params.push(to);

    let shopCond = "";
    if (shops) {
      shopCond = `AND COALESCE(o.shop_domain, s.shop_domain) = ANY($${i++}::text[])`;
      params.push(shops);
    }

    // Query principal: conteos + ingresos brutos
    const statsRow = await db.get(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE o.fulfillment_status = 'pendiente') AS pendientes,
        COUNT(*) FILTER (WHERE o.fulfillment_status IN ('en_preparacion','enviado','en_transito','franquicia')) AS en_transito,
        COUNT(*) FILTER (WHERE o.fulfillment_status = 'entregado') AS entregados,
        COUNT(*) FILTER (WHERE o.fulfillment_status = 'devuelto') AS devueltos,
        COUNT(*) FILTER (WHERE o.fulfillment_status = 'destruido') AS destruidos,
        COUNT(*) FILTER (WHERE o.fulfillment_status NOT IN ('pendiente','cancelado')) AS enviados,
        COUNT(*) FILTER (WHERE o.fulfillment_status != 'cancelado') AS pedidos_activos,
        COALESCE(SUM(o.total_price), 0) AS ingresos_brutos
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE (o.shop_id IN (${shopSubquery}) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
         ${dateCondFrom} ${dateCondTo} ${shopCond}`,
      params
    );

    // Query descuento cancelados: cancelados cuyo cancelled_at cae en el rango
    const cancelParams = [userId];
    let j = 2;
    const cancelDateFrom = from ? `AND (o.cancelled_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date >= $${j++}::date` : "";
    if (from) cancelParams.push(from);
    const cancelDateTo = to ? `AND (o.cancelled_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date <= $${j++}::date` : "";
    if (to) cancelParams.push(to);

    let cancelShopCond = "";
    if (shops) {
      cancelShopCond = `AND COALESCE(o.shop_domain, s.shop_domain) = ANY($${j++}::text[])`;
      cancelParams.push(shops);
    }

    const cancelRow = await db.get(
      `SELECT COALESCE(SUM(o.total_price), 0) AS descuento_cancelados
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE (o.shop_id IN (${shopSubquery}) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
         AND o.fulfillment_status = 'cancelado'
         AND o.cancelled_at IS NOT NULL
         ${cancelDateFrom} ${cancelDateTo} ${cancelShopCond}`,
      cancelParams
    );

    const ingresos = parseFloat(statsRow?.ingresos_brutos || 0);
    const descuento = parseFloat(cancelRow?.descuento_cancelados || 0);

    res.json({
      total:          parseInt(statsRow?.total || 0),
      pendientes:     parseInt(statsRow?.pendientes || 0),
      en_transito:    parseInt(statsRow?.en_transito || 0),
      entregados:     parseInt(statsRow?.entregados || 0),
      devueltos:      parseInt(statsRow?.devueltos || 0),
      destruidos:     parseInt(statsRow?.destruidos || 0),
      enviados:       parseInt(statsRow?.enviados || 0),
      pedidos_activos: parseInt(statsRow?.pedidos_activos || 0),
      facturacion:    ingresos - descuento,
    });
  } catch (e) {
    console.error("metrics/stats error:", e);
    res.status(500).json({ error: "Error calculando métricas" });
  }
});

// GET /api/metrics/ads-table
// Params: shop (requerido), month, year
// Devuelve: array de días con { day, ingresos, pedidos, descuento_cancelados, facturacion }
router.get("/ads-table", auth, async (req, res) => {
  const userId = req.user.id;
  const shop   = req.query.shop;
  const month  = parseInt(req.query.month);
  const year   = parseInt(req.query.year);

  if (!shop || !month || !year) return res.status(400).json({ error: "Faltan parámetros" });

  const monthStr = String(month).padStart(2, "0");
  const from = `${year}-${monthStr}-01`;
  // Último día del mes
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  try {
    // Ingresos y pedidos agrupados por día de creación
    const ingresosRows = await db.all(
      `SELECT
         TO_CHAR((o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date, 'YYYY-MM-DD') AS day,
         COALESCE(SUM(o.total_price), 0) AS ingresos,
         COUNT(*) FILTER (WHERE o.fulfillment_status != 'cancelado') AS pedidos
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1)
         AND COALESCE(o.shop_domain, s.shop_domain) = $2
         AND (o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date >= $3::date
         AND (o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date <= $4::date
       GROUP BY TO_CHAR((o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date, 'YYYY-MM-DD')
       ORDER BY day`,
      [userId, shop, from, to]
    );

    // Descuento cancelados agrupado por día de cancelación
    const cancelRows = await db.all(
      `SELECT
         TO_CHAR((o.cancelled_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date, 'YYYY-MM-DD') AS day,
         COALESCE(SUM(o.total_price), 0) AS descuento
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1)
         AND COALESCE(o.shop_domain, s.shop_domain) = $2
         AND o.fulfillment_status = 'cancelado'
         AND o.cancelled_at IS NOT NULL
         AND (o.cancelled_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date >= $3::date
         AND (o.cancelled_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date <= $4::date
       GROUP BY TO_CHAR((o.cancelled_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date, 'YYYY-MM-DD')`,
      [userId, shop, from, to]
    );

    // Indexar por fecha para lookup O(1) — r.day siempre es 'YYYY-MM-DD' gracias a TO_CHAR
    const ingresosMap = {};
    ingresosRows.forEach(r => { ingresosMap[r.day] = r; });
    const cancelMap = {};
    cancelRows.forEach(r => { cancelMap[r.day] = parseFloat(r.descuento || 0); });

    // Construir array completo del mes día a día
    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${monthStr}-${String(d).padStart(2, "0")}`;
      const ing = ingresosMap[dateStr];
      const ingresos  = parseFloat(ing?.ingresos || 0);
      const pedidos   = parseInt(ing?.pedidos || 0);
      const descuento = cancelMap[dateStr] || 0;
      days.push({ day: d, dateStr, ingresos, pedidos, descuento, facturacion: ingresos - descuento });
    }

    res.json(days);
  } catch (e) {
    console.error("metrics/ads-table error:", e);
    res.status(500).json({ error: "Error calculando tabla ads" });
  }
});

module.exports = router;
