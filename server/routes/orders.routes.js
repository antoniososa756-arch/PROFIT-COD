const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();
const { carrierCond } = require("../utils/carrier");

// Migración: añadir columna fecha_pago si no existe
db.run(`ALTER TABLE reembolsos_estado ADD COLUMN IF NOT EXISTS fecha_pago TEXT`).catch(() => {});

// Búsqueda por cualquier dato del pedido (ver orders.search_text en db.js):
// número, seguimiento, nombre, email, dirección y teléfono. Si lo buscado es
// un teléfono ("+34 685 95 05", "0034685..."), se compara solo en dígitos y
// sin el 34. Devuelve el SQL y los parámetros que añade a partir de $i.
function busquedaPedido(q, i) {
  const texto = String(q).trim();
  const norm = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Solo search_text (ya incluye número, seguimiento y nombre): así usa el
  // índice trigram. Con un OR a otras columnas Postgres recorría la tabla
  // entera y cada búsqueda tardaba segundos.
  const conds = [`o.search_text LIKE $${i}`];
  const params = [`%${norm}%`];
  let digitos = texto.replace(/\D/g, "");
  if (/^[\d\s+().-]+$/.test(texto) && digitos.length >= 3) {
    digitos = digitos.replace(/^00/, "");
    if (digitos.length >= 11 && digitos.startsWith("34")) digitos = digitos.slice(2);
    conds.push(`o.search_text LIKE $${i + 1}`);
    params.push(`%${digitos}%`);
  }
  return { sql: `(${conds.join(" OR ")})`, params };
}

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
    const b = busquedaPedido(q, i);
    conditions.push(b.sql); params.push(...b.params); i += b.params.length;
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
         o.total_price, o.currency, o.cancelled_at, o.mrw_estado_texto, o.carrier, o.estado_cambiado_at, o.note,
         COALESCE(o.shop_domain, s.shop_domain) as shop_domain`
      : `o.id, o.order_id, o.order_number, o.created_at, o.tracking_number,
         o.fulfillment_status, o.financial_status, o.customer_name,
         o.total_price, o.currency, o.cancelled_at, o.raw_json, o.mrw_estado_texto, o.carrier, o.note,
         COALESCE(o.shop_domain, s.shop_domain) as shop_domain`;

    const { where, params, nextIndex: i } = buildOrdersWhere(req, userId);

    if (!paginate && req.query.compact === "1") {
      // Modo compacto (Rentabilidad / balance): todos los pedidos del rango,
      // pero de raw_json solo lo que usan esos cálculos (estado de pago y
      // productos). Antes se mandaba el raw_json entero de Shopify: con rangos
      // de varios meses (miles de pedidos) eran cientos de MB, el servidor no
      // lo aguantaba y la pantalla se quedaba todo a 0. Se lee por tandas para
      // no tener todos los raw_json completos en memoria a la vez.
      // Ahora se lee raw_compact (ya recortado al grabar, ver db.js); solo
      // los pedidos que aún no lo tienen se recortan aquí desde raw_json.
      try {
        const rows = await db.all(
          `SELECT ${fields.replace("o.raw_json,", "o.raw_compact AS raw_json, (o.raw_compact IS NULL AND o.raw_json IS NOT NULL) AS sin_compact,")}
           FROM orders o
           LEFT JOIN shops s ON s.id = o.shop_id
           WHERE ${where}
           ORDER BY o.created_at DESC, o.id DESC`,
          params
        );
        const faltan = rows.filter((r) => r.sin_compact);
        for (let k = 0; k < faltan.length; k += 200) {
          const tanda = faltan.slice(k, k + 200);
          const raws = await db.all(`SELECT id, raw_json FROM orders WHERE id = ANY($1)`, [tanda.map((r) => r.id)]);
          const porId = Object.fromEntries(raws.map((r) => [r.id, r.raw_json]));
          for (const row of tanda) {
            let raw = null;
            try { raw = porId[row.id] ? JSON.parse(porId[row.id]) : null; } catch (e) {}
            row.raw_json = raw ? JSON.stringify({
              financial_status: raw.financial_status,
              line_items: (raw.line_items || []).map((li) => ({
                product_id: li.product_id, variant_id: li.variant_id, quantity: li.quantity,
                title: li.title, variant_title: li.variant_title, price: li.price, sku: li.sku, name: li.name,
              })),
            }) : null;
          }
        }
        for (const row of rows) {
          delete row.sin_compact;
          if (row.raw_json === "null") row.raw_json = null;
        }
        return res.json(rows);
      } catch (e) {
        console.error("Orders compact (raw_compact) fallback:", e.message);
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

    // Modo paginado: devuelve { orders, total, page, pages }. nocount=1 (el
    // buscador de arriba) no necesita el total y se ahorra el COUNT.
    const [countRow, rows] = await Promise.all([
      req.query.nocount === "1" ? Promise.resolve(null) : db.get(
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

    if (q)    { const b = busquedaPedido(q, i); conditions.push(b.sql); params.push(...b.params); i += b.params.length; }
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

// PATCH /api/orders/:id/note  { note: "texto" } — guarda la nota del pedido en
// Shopify (igual que /tags) y localmente. Texto vacío = borrar la nota.
router.patch("/:id/note", auth, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { note } = req.body || {};
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });
  if (typeof note !== "string") return res.status(400).json({ error: "note debe ser texto" });
  if (note.length > 5000) return res.status(400).json({ error: "La nota es demasiado larga (máx. 5000 caracteres)" });

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
      body: JSON.stringify({ order: { id: parseInt(row.order_id), note } }),
    });
    if (!shopifyRes.ok) {
      console.error("Shopify note update error:", shopifyRes.status, await shopifyRes.text());
      return res.status(502).json({ error: "No se pudo guardar la nota en Shopify" });
    }
    const shopifyData = await shopifyRes.json();

    // raw_json nuevo -> los triggers actualizan orders.note y la búsqueda
    if (shopifyData.order) {
      await db.run(`UPDATE orders SET raw_json = $1 WHERE id = $2`, [JSON.stringify(shopifyData.order), id]);
    }

    res.json({ ok: true, note: shopifyData.order?.note ?? note });
  } catch (e) {
    console.error("update note error:", e);
    res.status(500).json({ error: "Error guardando la nota" });
  }
});

// PATCH /api/orders/:id/datos — edita datos del cliente y dirección de envío
// del pedido en Shopify y localmente. Body (todo opcional):
//   { email, phone, customer_name, shipping_address: { first_name, last_name,
//     company, address1, address2, zip, city, province, country, country_code, phone } }
// email/teléfono/dirección van en el propio pedido (permiso write_orders). El
// nombre del cliente es del objeto Customer de Shopify: si la tienda no tiene
// ese permiso se avisa y no se cambia (el resto sí se guarda).
router.patch("/:id/datos", auth, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const body = req.body || {};
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });

  // Mensaje legible de un error de Shopify ({"errors":{"phone":["is invalid"]}})
  const errorShopify = async (r) => {
    const txt = await r.text();
    try {
      const j = JSON.parse(txt);
      const e = j.errors;
      if (typeof e === "string") return e;
      if (e && typeof e === "object") {
        const CAMPOS = { phone: "Teléfono", email: "Email", "shipping_address": "Dirección", zip: "Código postal", province: "Provincia", country: "País" };
        return Object.entries(e).map(([k, v]) => `${CAMPOS[k] || k}: ${[].concat(v).join(", ")}`).join(" · ");
      }
    } catch (_) {}
    return `Shopify respondió ${r.status}`;
  };

  try {
    const row = await db.get(
      `SELECT o.order_id, o.raw_json, COALESCE(o.shop_domain, s.shop_domain) as shop_domain
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE o.id = $1
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $2) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2))`,
      [id, userId]
    );
    if (!row) return res.status(404).json({ error: "Pedido no encontrado" });
    const shopRow = await db.get(`SELECT access_token FROM shops WHERE shop_domain = $1 AND user_id = $2`, [row.shop_domain, userId]);
    if (!shopRow) return res.status(404).json({ error: "Tienda no encontrada" });
    const H = { "Content-Type": "application/json", "X-Shopify-Access-Token": shopRow.access_token };
    const base = `https://${row.shop_domain}/admin/api/2024-10`;
    let raw = {};
    try { raw = JSON.parse(row.raw_json || "{}"); } catch (_) {}

    const pedido = { id: parseInt(row.order_id) };
    if (typeof body.email === "string") pedido.email = body.email.trim();
    if (typeof body.phone === "string") pedido.phone = body.phone.trim() || null;
    if (body.shipping_address && typeof body.shipping_address === "object") {
      const CAMPOS = ["first_name", "last_name", "company", "address1", "address2", "zip", "city", "province", "country", "country_code", "phone"];
      pedido.shipping_address = {};
      for (const k of CAMPOS) {
        if (body.shipping_address[k] !== undefined) pedido.shipping_address[k] = String(body.shipping_address[k] ?? "").trim();
      }
    }

    let nuevoRaw = raw;
    if (Object.keys(pedido).length > 1) {
      const r = await fetch(`${base}/orders/${row.order_id}.json`, { method: "PUT", headers: H, body: JSON.stringify({ order: pedido }) });
      if (!r.ok) {
        const msg = await errorShopify(r);
        console.error("Shopify datos update error:", r.status, msg);
        return res.status(502).json({ error: `Shopify no aceptó los cambios — ${msg}` });
      }
      const data = await r.json();
      if (data.order) nuevoRaw = data.order;
    }

    // Nombre del cliente (objeto Customer)
    let aviso = null;
    const nombre = typeof body.customer_name === "string" ? body.customer_name.trim().replace(/\s+/g, " ") : null;
    if (nombre) {
      const [first_name, ...resto] = nombre.split(" ");
      const last_name = resto.join(" ");
      const custId = raw.customer?.id;
      let ok = false;
      if (custId) {
        const r = await fetch(`${base}/customers/${custId}.json`, { method: "PUT", headers: H, body: JSON.stringify({ customer: { id: custId, first_name, last_name } }) });
        ok = r.ok;
        if (!ok) console.error("Shopify customer update error:", r.status, await r.text());
      }
      if (ok) {
        nuevoRaw.customer = { ...(nuevoRaw.customer || raw.customer || {}), first_name, last_name };
        await db.run(`UPDATE orders SET customer_name = $1 WHERE id = $2`, [nombre, id]);
      } else {
        aviso = "El nombre del cliente no se pudo cambiar en Shopify (la tienda no da permiso para editar clientes). El resto se guardó.";
      }
    }

    // raw_json nuevo -> los triggers actualizan búsqueda, email/teléfono, etc.
    await db.run(`UPDATE orders SET raw_json = $1 WHERE id = $2`, [JSON.stringify(nuevoRaw), id]);
    res.json({ ok: true, aviso });
  } catch (e) {
    console.error("update datos error:", e);
    res.status(500).json({ error: "Error guardando los cambios" });
  }
});

// POST /api/orders/:id/archivar { archivar: true|false } — archiva (close) o
// desarchiva (open) el pedido en Shopify y guarda el pedido devuelto.
router.post("/:id/archivar", auth, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });
  const archivar = req.body?.archivar !== false;
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
    const shopRow = await db.get(`SELECT access_token FROM shops WHERE shop_domain = $1 AND user_id = $2`, [row.shop_domain, userId]);
    if (!shopRow) return res.status(404).json({ error: "Tienda no encontrada" });

    const r = await fetch(`https://${row.shop_domain}/admin/api/2024-10/orders/${row.order_id}/${archivar ? "close" : "open"}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": shopRow.access_token },
      body: "{}",
    });
    if (!r.ok) {
      console.error("Shopify archivar error:", r.status, await r.text());
      return res.status(502).json({ error: archivar ? "Shopify no dejó archivar el pedido" : "Shopify no dejó desarchivar el pedido" });
    }
    const data = await r.json();
    if (data.order) await db.run(`UPDATE orders SET raw_json = $1 WHERE id = $2`, [JSON.stringify(data.order), id]);
    res.json({ ok: true, archivado: !!data.order?.closed_at });
  } catch (e) {
    console.error("archivar error:", e);
    res.status(500).json({ error: "Error archivando el pedido" });
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

    // Pedidos de este mismo cliente (por email o teléfono) en las tiendas del
    // usuario, como el "N pedidos" de Shopify -- con su estado, que en COD es
    // lo que importa (¿devolvió antes?).
    try {
      const k = await db.get("SELECT customer_email, customer_phone FROM orders WHERE id = $1", [id]);
      const email = k?.customer_email || "", phone = k?.customer_phone || "";
      if (email || phone) {
        row.cliente_pedidos = await db.all(
          `SELECT o.id, o.order_number, o.created_at, o.fulfillment_status, o.cancelled_at, o.total_price, o.currency, o.note
           FROM orders o
           WHERE ((o.customer_email = $1 AND $1 <> '') OR (o.customer_phone = $2 AND $2 <> ''))
             AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $3) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $3))
           ORDER BY o.created_at DESC LIMIT 50`,
          [email, phone, userId]
        );
      }
    } catch (e) { console.warn("Pedidos del cliente:", e.message); }

    res.json(row);
  } catch (e) {
    console.error("Order detail error:", e);
    res.status(500).json({ error: "Error obteniendo el pedido" });
  }
});

module.exports = router;
