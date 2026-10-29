const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();
const { carrierCond } = require("../utils/carrier");

// Migración: añadir columna fecha_pago si no existe
db.run(`ALTER TABLE reembolsos_estado ADD COLUMN IF NOT EXISTS fecha_pago TEXT`).catch(() => {});

// Construye el WHERE + params de filtros de pedidos compartido entre el listado
// paginado y /ids (navegación anterior/siguiente en el detalle del pedido) —
// mismos filtros, mismo orden, para que ambos representen la misma lista.
function buildOrdersWhere(req, userId) {
  const shop   = req.query.shop   || null;
  const status = req.query.status || null;
  const from   = req.query.from   || null;
  const to     = req.query.to     || null;
  const q      = req.query.q      || null;
  const ids    = req.query.ids    || null;
  const hasTracking = req.query.hasTracking === "1";
  const mrwRejected = req.query.mrwRejected === "1";

  const conditions = [
    `(o.shop_id IN (SELECT id FROM shops WHERE user_id = $1) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))`
  ];
  const params = [userId];
  let i = 2;

  if (shop) { conditions.push(`COALESCE(o.shop_domain, s.shop_domain) = $${i++}`); params.push(shop); }
  if (status) {
    const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      conditions.push(`o.fulfillment_status = $${i++}`); params.push(statuses[0]);
    } else {
      conditions.push(`o.fulfillment_status = ANY($${i++}::text[])`); params.push(statuses);
    }
  }
  if (from)   { conditions.push(`(o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date >= $${i++}::date`); params.push(from); }
  if (to)     { conditions.push(`(o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date <= $${i++}::date`); params.push(to); }
  if (q) {
    conditions.push(`(o.order_number ILIKE $${i} OR o.customer_name ILIKE $${i} OR o.tracking_number ILIKE $${i})`);
    params.push(`%${q}%`); i++;
  }
  if (hasTracking) { conditions.push(`o.tracking_number IS NOT NULL AND o.tracking_number != ''`); }
  // Agencia (ctt|mrw): misma regla que Métricas, ver server/utils/carrier.js
  const carrierSql = carrierCond(req.query.carrier);
  if (carrierSql) conditions.push(carrierSql.replace(/^AND /, ""));
  if (mrwRejected) { conditions.push(`o.mrw_rejected = true AND o.fulfillment_status NOT IN ('entregado','devuelto','destruido','cancelado')`); }
  if (ids) {
    // Lista explícita de ids internos (ej. "pedidos que MRW no reconoce" u
    // otros listados puntuales) — ignora el resto de filtros de fecha/estado,
    // se usa sola para mostrar exactamente ese conjunto.
    const idList = ids.split(",").map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n));
    if (idList.length) { conditions.push(`o.id = ANY($${i++}::int[])`); params.push(idList); }
  }

  return { where: conditions.join(" AND "), params, nextIndex: i };
}

// GET /api/orders/ids — lista completa (solo ids, en orden) de los pedidos que
// cumplen los filtros actuales. La usa el detalle del pedido para las flechas
// anterior/siguiente y el contador "X de Y", igual que el "list view" de Shopify.
router.get("/ids", auth, async (req, res) => {
  try {
    const { where, params } = buildOrdersWhere(req, req.user.id);
    const rows = await db.all(
      `SELECT o.id FROM orders o LEFT JOIN shops s ON s.id = o.shop_id WHERE ${where} ORDER BY o.created_at DESC LIMIT 5000`,
      params
    );
    res.json({ ids: (rows || []).map(r => r.id) });
  } catch (e) {
    console.error("Orders ids error:", e);
    res.status(500).json({ error: "Error obteniendo pedidos" });
  }
});

// GET /api/orders  — soporta paginación y filtros server-side
// Params: page, limit, shop, status, from, to, q, light (sin raw_json)
router.get("/", auth, async (req, res) => {
  const userId = req.user.id;
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const light      = req.query.light === "1";

  // Paginar solo cuando se pide explícitamente con ?page
  // Los filtros (from, to, shop, status, q) funcionan en ambos modos
  const paginate = !!req.query.page;

  try {
    const fields = light
      ? `o.id, o.order_id, o.order_number, o.created_at, o.tracking_number,
         o.fulfillment_status, o.financial_status, o.customer_name,
         o.total_price, o.currency, o.cancelled_at, o.mrw_estado_texto, o.carrier,
         COALESCE(o.shop_domain, s.shop_domain) as shop_domain`
      : `o.id, o.order_id, o.order_number, o.created_at, o.tracking_number,
         o.fulfillment_status, o.financial_status, o.customer_name,
         o.total_price, o.currency, o.cancelled_at, o.raw_json, o.mrw_estado_texto, o.carrier,
         COALESCE(o.shop_domain, s.shop_domain) as shop_domain`;

    const { where, params, nextIndex: i } = buildOrdersWhere(req, userId);

    if (!paginate && req.query.compact === "1") {
      // Modo compacto (Rentabilidad / balance): todos los pedidos del rango,
      // pero de raw_json solo lo que usan esos cálculos (estado de pago y
      // productos). Antes se mandaba el raw_json entero de Shopify: con rangos
      // de varios meses (miles de pedidos) eran cientos de MB, el servidor no
      // lo aguantaba y la pantalla se quedaba todo a 0. Se lee por tandas para
      // no tener todos los raw_json completos en memoria a la vez.
      // Primero se intenta recortar el raw_json DENTRO de Postgres: así el
      // JSON enorme de Shopify ni viaja al servidor ni se parsea en Node, y va
      // en una sola consulta (sin OFFSET por tandas, que cada vez re-lee todo
      // lo anterior). Si falla (algún raw_json que no es JSON válido), se usa
      // el método por tandas de siempre.
      try {
        const compactFields = fields.replace("o.raw_json,", `CASE WHEN COALESCE(o.raw_json, '') = '' THEN NULL ELSE (
            SELECT json_build_object(
              'financial_status', x.j->>'financial_status',
              'line_items', COALESCE((
                SELECT json_agg(json_build_object(
                  'product_id', li->'product_id', 'variant_id', li->'variant_id', 'quantity', li->'quantity',
                  'title', li->'title', 'variant_title', li->'variant_title', 'price', li->'price',
                  'sku', li->'sku', 'name', li->'name'))
                FROM json_array_elements(CASE WHEN json_typeof(x.j->'line_items') = 'array' THEN x.j->'line_items' ELSE '[]'::json END) li
              ), '[]'::json)
            )::text
            FROM (SELECT o.raw_json::json AS j) x
          ) END AS raw_json,`);
        const rows = await db.all(
          `SELECT ${compactFields}
           FROM orders o
           LEFT JOIN shops s ON s.id = o.shop_id
           WHERE ${where}
           ORDER BY o.created_at DESC, o.id DESC`,
          params
        );
        return res.json(rows || []);
      } catch (e) {
        console.error("Orders compact SQL fallback:", e.message);
      }
      const LOTE = 500;
      const out = [];
      for (let off = 0; ; off += LOTE) {
        const lote = await db.all(
          `SELECT ${fields}
           FROM orders o
           LEFT JOIN shops s ON s.id = o.shop_id
           WHERE ${where}
           ORDER BY o.created_at DESC, o.id DESC
           LIMIT ${LOTE} OFFSET ${off}`,
          params
        );
        for (const row of lote) {
          let raw = null;
          try { raw = row.raw_json ? JSON.parse(row.raw_json) : null; } catch (e) {}
          row.raw_json = raw ? JSON.stringify({
            financial_status: raw.financial_status,
            line_items: (raw.line_items || []).map((li) => ({
              product_id: li.product_id, variant_id: li.variant_id, quantity: li.quantity,
              title: li.title, variant_title: li.variant_title, price: li.price, sku: li.sku, name: li.name,
            })),
          }) : null;
          out.push(row);
        }
        if (lote.length < LOTE) break;
      }
      return res.json(out);
    }

    if (!paginate) {
      // Compatibilidad: devuelve array plano sin raw_json para reducir payload
      const rows = await db.all(
        `SELECT ${fields}
         FROM orders o
         LEFT JOIN shops s ON s.id = o.shop_id
         WHERE ${where}
         ORDER BY o.created_at DESC`,
        params
      );
      return res.json(rows || []);
    }

    // Modo paginado: devuelve { orders, total, page, pages }
    const [countRow, rows] = await Promise.all([
      db.get(
        `SELECT COUNT(*) as total FROM orders o LEFT JOIN shops s ON s.id = o.shop_id WHERE ${where}`,
        params
      ),
      db.all(
        `SELECT ${fields}
         FROM orders o
         LEFT JOIN shops s ON s.id = o.shop_id
         WHERE ${where}
         ORDER BY o.created_at DESC
         LIMIT $${i} OFFSET $${i+1}`,
        [...params, limit, offset]
      )
    ]);

    const total = parseInt(countRow?.total || 0);
    res.json({ orders: rows || [], total, page, pages: Math.ceil(total / limit) });

  } catch (e) {
    console.error("Orders fetch error:", e);
    res.status(500).json({ error: "Error obteniendo pedidos" });
  }
});

router.get("/reembolso-estado", auth, async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT order_id, tracking_number, estado FROM reembolsos_estado WHERE user_id = $1",
      [req.user.id]
    );
    res.json(rows || []);
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

// GET /api/orders/reembolsos — pedidos entregados con pago pendiente (COD)
router.get("/reembolsos", auth, async (req, res) => {
  const userId   = req.user.id;
  const shop     = req.query.shop   || null;
  const from     = req.query.from   || null;
  const to       = req.query.to     || null;
  const estado   = req.query.estado || null; // "cobrado" | "pendiente" | null (todos)
  const q        = req.query.q     || null;
  const page     = Math.max(1, parseInt(req.query.page) || 1);
  const limit    = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 100));
  const offset   = (page - 1) * limit;

  try {
    const conditions = [
      `(SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1)`,
      `o.fulfillment_status = 'entregado'`,
      `o.financial_status IN ('pending','cod','pendiente')`
    ];
    const params = [userId];
    let i = 2;

    if (q)    { conditions.push(`(o.order_number ILIKE $${i} OR o.tracking_number ILIKE $${i} OR o.customer_name ILIKE $${i})`); params.push(`%${q}%`); i++; }
    if (shop) { conditions.push(`COALESCE(o.shop_domain, s.shop_domain) = $${i++}`); params.push(shop); }
    if (from) { conditions.push(`(o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date >= $${i++}::date`); params.push(from); }
    if (to)   { conditions.push(`(o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date <= $${i++}::date`); params.push(to); }
    // Agencia (id del registro de utils/carrier.js) -- Reembolsos y widget del menú
    const carrierSql = carrierCond(req.query.carrier);
    if (carrierSql) conditions.push(carrierSql.replace(/^AND /, ""));

    // Filtro por estado de pago (JOIN con reembolsos_estado)
    let estadoJoin = `LEFT JOIN reembolsos_estado re ON re.order_id = o.id::text AND re.user_id = $1`;
    if (estado === "cobrado") {
      conditions.push(`re.estado = 'cobrado'`);
    } else if (estado === "pendiente") {
      conditions.push(`(re.estado IS NULL OR re.estado != 'cobrado')`);
    }

    const where = conditions.join(" AND ");
    const baseQuery = `FROM orders o LEFT JOIN shops s ON s.id = o.shop_id ${estadoJoin} WHERE ${where}`;

    const [countRow, rows] = await Promise.all([
      db.get(`SELECT COUNT(*) as total, COALESCE(SUM(o.total_price),0) as total_amount ${baseQuery}`, params),
      db.all(
        `SELECT o.id, o.order_number, o.created_at, o.tracking_number,
                o.fulfillment_status, o.financial_status, o.customer_name,
                o.total_price, o.currency, COALESCE(o.shop_domain, s.shop_domain) as shop_domain,
                re.estado as estado_pago, re.fecha_pago, o.carrier
         ${baseQuery}
         ORDER BY o.created_at DESC
         LIMIT $${i} OFFSET $${i+1}`,
        [...params, limit, offset]
      )
    ]);

    const total = parseInt(countRow?.total || 0);
    res.json({ orders: rows || [], total, total_amount: parseFloat(countRow?.total_amount || 0), page, pages: Math.ceil(total/limit) });
  } catch(e) { console.error(e); res.status(500).json({ error: "Error" }); }
});

router.post("/reembolso-estado", auth, async (req, res) => {
  const { order_id, estado } = req.body;
  try {
    await db.run(
     `INSERT INTO reembolsos_estado (user_id, order_id, tracking_number, estado, fecha_pago)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(user_id, order_id) DO UPDATE SET estado = EXCLUDED.estado, tracking_number = EXCLUDED.tracking_number, fecha_pago = COALESCE(reembolsos_estado.fecha_pago, EXCLUDED.fecha_pago)`,
      [req.user.id, order_id, req.body.tracking_number || null, estado, new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(new Date())]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: "Error" }); }
});

// POST /api/orders/marcar-entregado  { order_id } or { id }
router.post("/marcar-entregado", auth, async (req, res) => {
  const { order_id, id } = req.body;
  if (!order_id && !id) return res.status(400).json({ error: "Falta order_id" });
  try {
    const result = await db.run(
      order_id
        ? `UPDATE orders SET fulfillment_status = 'entregado', updated_at = now()::text
           WHERE order_id = $1
             AND (SELECT shop_domain FROM shops WHERE id = shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2)
             AND fulfillment_status NOT IN ('entregado', 'cancelado')`
        : `UPDATE orders SET fulfillment_status = 'entregado', updated_at = now()::text
           WHERE id = $1
             AND (SELECT shop_domain FROM shops WHERE id = shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2)
             AND fulfillment_status NOT IN ('entregado', 'cancelado')`,
      [order_id || id, req.user.id]
    );
    if (!result.changes) return res.status(404).json({ error: "Pedido no encontrado o ya entregado" });
    res.json({ ok: true });
  } catch(e) { console.error("marcar-entregado:", e); res.status(500).json({ error: "Error" }); }
});

// POST /api/orders/marcar-estado  { order_id|id, estado }
const ESTADOS_FINALES = ["entregado", "cancelado", "destruido", "devuelto"];
router.post("/marcar-estado", auth, async (req, res) => {
  const { order_id, id, estado } = req.body;
  if (!order_id && !id) return res.status(400).json({ error: "Falta order_id" });
  if (!ESTADOS_FINALES.includes(estado)) return res.status(400).json({ error: "Estado no válido" });
  try {
    // Sin filtrar por shops.status='active': la tienda puede estar desactivada
    // y el pedido sigue siendo real y del usuario, debe poder actualizarse igual.
    const result = await db.run(
      order_id
        ? `UPDATE orders SET fulfillment_status = $1, updated_at = now()::text, mrw_rejected = false
           WHERE order_id = $2 AND (SELECT shop_domain FROM shops WHERE id = shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $3)`
        : `UPDATE orders SET fulfillment_status = $1, updated_at = now()::text, mrw_rejected = false
           WHERE id = $2 AND (SELECT shop_domain FROM shops WHERE id = shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $3)`,
      [estado, order_id || id, req.user.id]
    );
    if (!result.changes) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json({ ok: true });
  } catch(e) { console.error("marcar-estado:", e); res.status(500).json({ error: "Error" }); }
});

// POST /api/orders/marcar-estado-bulk  { ids: [...], estado }
router.post("/marcar-estado-bulk", auth, async (req, res) => {
  const { ids, estado } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "Faltan pedidos" });
  if (!ESTADOS_FINALES.includes(estado)) return res.status(400).json({ error: "Estado no válido" });
  try {
    const result = await db.run(
      `UPDATE orders SET fulfillment_status = $1, updated_at = now()::text, mrw_rejected = false
       WHERE id = ANY($2::int[]) AND (SELECT shop_domain FROM shops WHERE id = shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $3)`,
      [estado, ids, req.user.id]
    );
    res.json({ ok: true, updated: result.changes || 0 });
  } catch(e) { console.error("marcar-estado-bulk:", e); res.status(500).json({ error: "Error" }); }
});

// PATCH /api/orders/:id/tags  { tags: "tag1, tag2" } — reemplaza las etiquetas en Shopify y localmente
router.patch("/:id/tags", auth, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { tags } = req.body || {};
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });
  if (typeof tags !== "string") return res.status(400).json({ error: "tags debe ser texto" });

  try {
    const row = await db.get(
      `SELECT o.order_id, COALESCE(o.shop_domain, s.shop_domain) as shop_domain
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE o.id = $1
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $2) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2))`,
      [id, userId]
    );
    if (!row) return res.status(404).json({ error: "Pedido no encontrado" });

    const shopRow = await db.get(
      `SELECT access_token FROM shops WHERE shop_domain = $1 AND user_id = $2`,
      [row.shop_domain, userId]
    );
    if (!shopRow) return res.status(404).json({ error: "Tienda no encontrada" });

    const shopifyRes = await fetch(`https://${row.shop_domain}/admin/api/2024-10/orders/${row.order_id}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": shopRow.access_token },
      body: JSON.stringify({ order: { id: parseInt(row.order_id), tags } }),
    });
    if (!shopifyRes.ok) {
      console.error("Shopify tags update error:", shopifyRes.status, await shopifyRes.text());
      return res.status(502).json({ error: "No se pudo actualizar la etiqueta en Shopify" });
    }
    const shopifyData = await shopifyRes.json();

    if (shopifyData.order) {
      await db.run(`UPDATE orders SET raw_json = $1 WHERE id = $2`, [JSON.stringify(shopifyData.order), id]);
    }

    res.json({ ok: true, tags });
  } catch (e) {
    console.error("update tags error:", e);
    res.status(500).json({ error: "Error actualizando etiquetas" });
  }
});

// GET /api/orders/:id — detalle completo de un pedido (incluye raw_json de Shopify)
// Nota: se registra al final para no capturar las rutas fijas de arriba (/reembolsos, etc.)
router.get("/:id", auth, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });
  try {
    const row = await db.get(
      `SELECT o.id, o.order_id, o.order_number, o.created_at, o.tracking_number, o.carrier,
              o.fulfillment_status, o.financial_status, o.customer_name,
              o.total_price, o.currency, o.cancelled_at, o.raw_json,
              COALESCE(o.shop_domain, s.shop_domain) as shop_domain,
              re.estado as estado_cobro, re.fecha_pago
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       LEFT JOIN reembolsos_estado re ON re.order_id = o.id::text AND re.user_id = $2
       WHERE o.id = $1
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $2) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2))`,
      [id, userId]
    );
    if (!row) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(row);
  } catch (e) {
    console.error("Order detail error:", e);
    res.status(500).json({ error: "Error obteniendo el pedido" });
  }
});

module.exports = router;
