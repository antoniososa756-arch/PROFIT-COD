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

// GET /api/metrics/top-products
// Devuelve top 5 productos más vendidos del mes en curso
// Si el producto pertenece a un grupo vinculado, agrupa sus ventas bajo el nombre del grupo
router.get("/top-products", async (req, res) => {
  const userId = req.user.id;
  let shops = req.query.shops || null;
  if (shops && typeof shops === "string") shops = shops.split(",").map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(shops) || shops.length === 0) shops = null;

  try {
    // 1. Ventas del mes en curso por product_id
    const salesParams = [userId];
    let shopCond = "";
    if (shops) {
      shopCond = `AND sm.shop_domain = ANY($2::text[])`;
      salesParams.push(shops);
    }

    const salesRows = await db.all(
      `SELECT sm.product_id,
         SUM(CASE WHEN sm.movement_type = 'salida'     THEN sm.units ELSE 0 END) -
         SUM(CASE WHEN sm.movement_type = 'devolucion' THEN sm.units ELSE 0 END) AS units_sold
       FROM stock_movements sm
       WHERE sm.user_id = $1
         AND sm.movement_type IN ('salida','devolucion')
         AND sm.movement_date >= date_trunc('month', CURRENT_DATE)
         AND sm.movement_date <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
         ${shopCond}
       GROUP BY sm.product_id
       HAVING SUM(CASE WHEN sm.movement_type = 'salida' THEN sm.units ELSE 0 END) > 0`,
      salesParams
    );

    if (!salesRows.length) return res.json([]);

    // 2. Stock efectivo actual (misma lógica que /api/shopify/stock)
    const stockRows = await db.all(
      `WITH
       group_mov AS (
         SELECT pgm.group_id,
           SUM(CASE WHEN sm.movement_type='salida' THEN -sm.units ELSE sm.units END) AS net
         FROM product_group_members pgm
         JOIN stock_movements sm ON sm.product_id = pgm.product_id AND sm.user_id = pgm.user_id
         WHERE pgm.user_id = $1 GROUP BY pgm.group_id
       ),
       group_base AS (
         SELECT pgm.group_id, SUM(COALESCE(ps.stock,0)) AS base
         FROM product_group_members pgm
         LEFT JOIN productos_stock ps ON ps.product_id = pgm.product_id AND ps.user_id = pgm.user_id
         WHERE pgm.user_id = $1 GROUP BY pgm.group_id
       ),
       indiv_mov AS (
         SELECT sm.product_id,
           SUM(CASE WHEN sm.movement_type='salida' THEN -sm.units ELSE sm.units END) AS net
         FROM stock_movements sm
         WHERE sm.user_id = $1
           AND sm.product_id NOT IN (SELECT product_id FROM product_group_members WHERE user_id = $1)
         GROUP BY sm.product_id
       )
       SELECT ps.product_id, pgm.group_id, pg.name AS group_name,
              COALESCE(gb.base,0) + COALESCE(gm.net,0) AS stock
       FROM productos_stock ps
       JOIN product_group_members pgm ON pgm.product_id = ps.product_id AND pgm.user_id = $1
       JOIN product_groups pg ON pg.id = pgm.group_id
       LEFT JOIN group_base gb ON gb.group_id = pgm.group_id
       LEFT JOIN group_mov  gm ON gm.group_id = pgm.group_id
       WHERE ps.user_id = $1
       UNION ALL
       SELECT ps.product_id, NULL, NULL,
              COALESCE(ps.stock,0) + COALESCE(im.net,0) AS stock
       FROM productos_stock ps
       LEFT JOIN indiv_mov im ON im.product_id = ps.product_id
       WHERE ps.user_id = $1
         AND ps.product_id NOT IN (SELECT product_id FROM product_group_members WHERE user_id = $1)
       UNION ALL
       SELECT sm.product_id, NULL, NULL,
              SUM(CASE WHEN sm.movement_type='salida' THEN -sm.units ELSE sm.units END) AS stock
       FROM stock_movements sm
       WHERE sm.user_id = $1
         AND sm.product_id NOT IN (SELECT product_id FROM productos_stock WHERE user_id = $1)
         AND sm.product_id NOT IN (SELECT product_id FROM product_group_members WHERE user_id = $1)
       GROUP BY sm.product_id`,
      [userId]
    );

    // 3. Mapa product_id → stock info
    const stockMap = {};
    stockRows.forEach(r => { stockMap[r.product_id] = r; });

    // 4. Agrupar ventas por grupo (o producto individual)
    const grouped = {};
    for (const sale of salesRows) {
      const si = stockMap[sale.product_id];
      const gid = si?.group_id || null;
      const key = gid ? `g_${gid}` : sale.product_id;
      if (!grouped[key]) {
        grouped[key] = {
          group_id: gid,
          group_name: si?.group_name || null,
          product_id: gid ? null : sale.product_id,
          units_sold: 0,
          stock: si?.stock != null ? parseFloat(si.stock) : 0,
        };
      }
      grouped[key].units_sold += parseInt(sale.units_sold) || 0;
    }

    // 5. Nombres de producto desde orders.raw_json (parseo en JS, no SQL)
    const titles = {};
    try {
      const recentOrders = await db.all(
        `SELECT raw_json FROM orders o
         WHERE (o.shop_id IN (SELECT id FROM shops WHERE user_id = $1)
            OR o.shop_domain IN (SELECT shop_domain FROM shops WHERE user_id = $1))
           AND o.raw_json IS NOT NULL AND length(o.raw_json) > 10
         ORDER BY o.created_at DESC LIMIT 200`,
        [userId]
      );
      for (const ord of recentOrders) {
        try {
          const raw = typeof ord.raw_json === "string" ? JSON.parse(ord.raw_json) : ord.raw_json;
          for (const item of (raw?.line_items || [])) {
            const pid = String(item.product_id || "");
            if (pid && !titles[pid] && item.title) titles[pid] = item.title;
          }
        } catch {}
      }
    } catch (te) { console.error("top-products titles:", te.message); }

    // 6. Top 5 ordenado por ventas
    const result = Object.values(grouped)
      .sort((a, b) => b.units_sold - a.units_sold)
      .slice(0, 5)
      .map((r, i) => ({
        rank: i + 1,
        display_name: r.group_name || titles[r.product_id] || r.product_id || "—",
        product_id: r.product_id,
        group_id: r.group_id,
        group_name: r.group_name,
        units_sold: r.units_sold,
        stock: r.stock,
      }));

    res.json(result);
  } catch (e) {
    console.error("top-products error:", e);
    res.status(500).json({ error: "Error calculando top productos" });
  }
});

module.exports = router;
