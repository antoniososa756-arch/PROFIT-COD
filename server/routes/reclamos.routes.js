const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

// GET /api/reclamos-mrw/ids — order_id de todos los pedidos ya reclamados por el usuario
router.get("/ids", auth, async (req, res) => {
  try {
    const rows = await db.all("SELECT order_id FROM reclamos_mrw WHERE user_id = $1", [req.user.id]);
    res.json((rows || []).map(r => r.order_id));
  } catch (e) { res.status(500).json({ error: "Error" }); }
});

// GET /api/reclamos-mrw — lista paginada de pedidos reclamados, con los mismos filtros que /api/orders
router.get("/", auth, async (req, res) => {
  const userId = req.user.id;
  const shop   = req.query.shop   || null;
  const status = req.query.status || null;
  const from   = req.query.from   || null;
  const to     = req.query.to     || null;
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  try {
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
    if (from) { conditions.push(`(o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date >= $${i++}::date`); params.push(from); }
    if (to)   { conditions.push(`(o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date <= $${i++}::date`); params.push(to); }

    const where = conditions.join(" AND ");
    const baseQuery = `FROM orders o
      LEFT JOIN shops s ON s.id = o.shop_id
      INNER JOIN reclamos_mrw rm ON rm.order_id = o.order_id AND rm.user_id = $1
      WHERE ${where}`;

    const [countRow, rows] = await Promise.all([
      db.get(`SELECT COUNT(*) as total ${baseQuery}`, params),
      db.all(
        `SELECT o.id, o.order_id, o.order_number, o.created_at, o.tracking_number,
                o.fulfillment_status, COALESCE(o.shop_domain, s.shop_domain) as shop_domain,
                rm.observacion, rm.created_at as reclamo_created_at
         ${baseQuery}
         ORDER BY rm.created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      )
    ]);

    const total = parseInt(countRow?.total || 0);
    res.json({ orders: rows || [], total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    console.error("reclamos-mrw fetch error:", e);
    res.status(500).json({ error: "Error obteniendo reclamos" });
  }
});

// POST /api/reclamos-mrw  { order_id, observacion? } — marca un pedido como reclamado
router.post("/", auth, async (req, res) => {
  const { order_id, observacion } = req.body || {};
  if (!order_id) return res.status(400).json({ error: "Falta order_id" });
  const obs = typeof observacion === "string" ? observacion : "";
  try {
    const owns = await db.get(
      `SELECT o.id FROM orders o
       WHERE o.order_id = $1
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $2) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2))`,
      [order_id, req.user.id]
    );
    if (!owns) return res.status(404).json({ error: "Pedido no encontrado" });

    await db.run(
      `INSERT INTO reclamos_mrw (user_id, order_id, observacion, created_at)
       VALUES ($1, $2, $3, now()::text)
       ON CONFLICT (user_id, order_id) DO UPDATE SET observacion = EXCLUDED.observacion`,
      [req.user.id, order_id, obs]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("reclamos-mrw create error:", e);
    res.status(500).json({ error: "Error" });
  }
});

// PUT /api/reclamos-mrw/:orderId/observacion  { observacion }
router.put("/:orderId/observacion", auth, async (req, res) => {
  const { observacion } = req.body || {};
  try {
    const result = await db.run(
      `UPDATE reclamos_mrw SET observacion = $1 WHERE user_id = $2 AND order_id = $3`,
      [typeof observacion === "string" ? observacion : "", req.user.id, req.params.orderId]
    );
    if (!result.changes) return res.status(404).json({ error: "Reclamo no encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error" }); }
});

// DELETE /api/reclamos-mrw/:orderId — quita un pedido de la lista de reclamos
router.delete("/:orderId", auth, async (req, res) => {
  try {
    await db.run(`DELETE FROM reclamos_mrw WHERE user_id = $1 AND order_id = $2`, [req.user.id, req.params.orderId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error" }); }
});

module.exports = router;
