const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

// GET /api/orders  — soporta paginación y filtros server-side
// Params: page, limit, shop, status, from, to, q, light (sin raw_json)
router.get("/", auth, async (req, res) => {
  const userId = req.user.id;
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const shop   = req.query.shop   || null;
  const status = req.query.status || null;
  const from   = req.query.from   || null;
  const to     = req.query.to     || null;
  const q      = req.query.q      || null;
  const light  = req.query.light === "1";

  // Paginar solo cuando se pide explícitamente con ?page
  // Los filtros (from, to, shop, status, q) funcionan en ambos modos
  const paginate = !!req.query.page;

  try {
    const fields = light
      ? `o.id, o.order_id, o.order_number, o.created_at, o.tracking_number,
         o.fulfillment_status, o.financial_status, o.customer_name,
         o.total_price, o.currency, o.cancelled_at,
         COALESCE(o.shop_domain, s.shop_domain) as shop_domain`
      : `o.id, o.order_id, o.order_number, o.created_at, o.tracking_number,
         o.fulfillment_status, o.financial_status, o.customer_name,
         o.total_price, o.currency, o.cancelled_at, o.raw_json,
         COALESCE(o.shop_domain, s.shop_domain) as shop_domain`;

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
    if (from)   { conditions.push(`LEFT(o.created_at, 10) >= $${i++}`); params.push(from); }
    if (to)     { conditions.push(`LEFT(o.created_at, 10) <= $${i++}`); params.push(to); }
    if (q) {
      conditions.push(`(o.order_number ILIKE $${i} OR o.customer_name ILIKE $${i} OR o.tracking_number ILIKE $${i})`);
      params.push(`%${q}%`); i++;
    }

    const where = conditions.join(" AND ");

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

    if (shop) { conditions.push(`COALESCE(o.shop_domain, s.shop_domain) = $${i++}`); params.push(shop); }
    if (from) { conditions.push(`(o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date >= $${i++}::date`); params.push(from); }
    if (to)   { conditions.push(`(o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date <= $${i++}::date`); params.push(to); }

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
                re.estado as estado_pago
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
     `INSERT INTO reembolsos_estado (user_id, order_id, tracking_number, estado)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(user_id, order_id) DO UPDATE SET estado = EXCLUDED.estado, tracking_number = EXCLUDED.tracking_number`,
      [req.user.id, order_id, req.body.tracking_number || null, estado]
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
    const result = await db.run(
      order_id
        ? `UPDATE orders SET fulfillment_status = $1, updated_at = now()::text
           WHERE order_id = $2 AND (SELECT shop_domain FROM shops WHERE id = shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $3 AND status = 'active')`
        : `UPDATE orders SET fulfillment_status = $1, updated_at = now()::text
           WHERE id = $2 AND (SELECT shop_domain FROM shops WHERE id = shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $3 AND status = 'active')`,
      [estado, order_id || id, req.user.id]
    );
    if (!result.changes) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json({ ok: true });
  } catch(e) { console.error("marcar-estado:", e); res.status(500).json({ error: "Error" }); }
});

module.exports = router;
