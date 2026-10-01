const express = require("express");
const db = require("../db");
const auth = require("../middlewares/auth");
const sseManager = require("../sse");
const router = express.Router();

// ── Script de tracking servido dinámicamente ──────────────────────────────────
router.get("/script.js", async (req, res) => {
  const shop = (req.query.shop || "").toLowerCase().trim();
  if (!shop) return res.status(400).send("// falta ?shop=dominio");

  const shopRow = await db.get(
    "SELECT user_id FROM shops WHERE LOWER(shop_domain) = $1 AND status = 'active'",
    [shop]
  ).catch(() => null);
  if (!shopRow) return res.status(404).send("// tienda no encontrada en PROFIT-COD");

  const appUrl = process.env.APP_URL || "https://profit-cod.onrender.com";

  const script = `/* PROFIT-COD COD Tracker v4 */
(function(){
  var SHOP="${shop}", API="${appUrl}";
  var sid=sessionStorage.getItem("_pc_sid");
  if(!sid){sid=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem("_pc_sid",sid);}
  var fd={}, tracked=false, attachedForm=null;
  var FM={
    "Nombre y apellidos":"nombre","Teléfono":"telefono",
    "Dirección (Calle y número)":"direccion","Casa, Piso, Local...":"direccion2",
    "Ciudad":"ciudad","Código postal":"cp","Email (opcional)":"email",
    "Nombre":"nombre","Phone":"telefono","Address":"direccion","City":"ciudad","Zip":"cp","Email":"email"
  };
  function send(type,extra){
    var p=Object.assign({shop:SHOP,sid:sid,type:type,url:location.href},extra||{});
    fetch(API+"/api/cod-tracker/event",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(p),
      keepalive:true
    }).catch(function(){});
  }
  function fieldName(el){return FM[el.placeholder]||FM[el.name]||el.name||el.placeholder||"campo";}
  function attachForm(form){
    if(attachedForm===form)return;
    attachedForm=form;
    form.querySelectorAll("input,select,textarea").forEach(function(el){
      el.addEventListener("focus",function(){send("field_focus",{field:fieldName(el)});});
      // Solo "blur" (salió del campo) -- "change" dispara casi al mismo
      // tiempo para el mismo cambio y duplicaba cada dato en la cronología.
      el.addEventListener("blur",function(){
        if(el.value){fd[fieldName(el)]=el.value;send("field_blur",{field:fieldName(el),value:el.value,formData:fd});}
      });
    });
    form.addEventListener("submit",function(){send("form_submit",{formData:fd});},true);
  }
  // En vez de dejar un observer pegado a UNA referencia del modal (frágil si la
  // app lo reemplaza/recrea en vez de solo cambiarle la clase), se pregunta de
  // cero cada 700ms si está abierto ahora mismo -- funciona sin importar cómo
  // lo maneje la app por dentro. "Abandonó el formulario" ya NO termina la
  // sesión -- el cliente sigue en la tienda, solo cerró el formulario.
  //
  // closedStreak exige verlo cerrado en 2 chequeos seguidos (~1.4s) antes de
  // avisar -- la propia app de Releasit parece quitar y volver a poner la
  // clase "abierto" por un instante al cambiar de campo (visto con el
  // autocompletado de dirección), y sin este margen eso se registraba como un
  // cierre y reapertura real del formulario.
  var closedStreak=0;
  function checkState(){
    var modal=document.getElementById("_rsi-cod-form-modal");
    var isOpen=!!(modal&&modal.classList.contains("_rsi-cod-form-modal-open"));
    if(isOpen){
      closedStreak=0;
      if(!tracked){
        tracked=true; fd={};
        send("form_open");
        var form=document.getElementById("_rsi-cod-form-modal-form");
        if(form)attachForm(form);
      }
    } else if(tracked){
      closedStreak++;
      if(closedStreak>=2){
        tracked=false; attachedForm=null; closedStreak=0;
        send("form_abandon",{formData:fd});
      }
    }
  }
  // "En vivo" ya no depende de tener el formulario abierto -- este latido cada
  // 20s mientras la pestaña está visible es lo que mantiene la sesión activa
  // en cualquier parte de la tienda. Si se pone en segundo plano (el típico
  // "vuelve a Instagram sin cerrar nada") los latidos paran solos.
  function heartbeat(){
    if(document.visibilityState==="visible") send("heartbeat");
  }
  send("page_view");
  checkState();
  setInterval(checkState,700);
  setInterval(heartbeat,20000);
  // Esto sí es salir de verdad (cerrar la pestaña o navegar fuera del sitio) --
  // ahí termina la sesión en vivo, haya formulario abierto o no.
  addEventListener("pagehide",function(){
    send("page_abandon",{formData:fd});
  });
})();`;

  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public, max-age=30");
  res.send(script);
});

// ── Recibir evento del tracker (sin auth, viene del navegador del cliente) ─────
router.options("/event", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(204).end();
});

// OJO: NO poner express.json() aquí — server/index.js ya aplica el parser JSON
// global antes de montar esta ruta, así que el stream del body ya viene
// consumido. Un segundo express.json() en esta ruta lee un stream vacío y deja
// req.body en {} en silencio (sin error visible), lo que causaba que ningún
// evento se guardara nunca a pesar de que el script sí llegaba a la tienda y
// recibía su 204 — exactamente el bug de "no trae ningún dato" de la vez pasada.
// Geolocaliza una sesión por IP (país/provincia) una sola vez -- se usa el
// primer "page_view" de cada sesión. ip-api.com es gratis sin API key para
// este volumen; si falla o no hay IP, simplemente queda sin país/provincia.
async function geolocateSession(shopDomain, sid, ip) {
  try {
    if (!ip) return;
    const existing = await db.get(
      "SELECT country FROM checkout_sessions WHERE shop_domain = $1 AND session_id = $2",
      [shopDomain, sid]
    );
    if (existing?.country) return;
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName`, { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    if (d.status === "success") {
      await db.run(
        "UPDATE checkout_sessions SET country = $1, region = $2 WHERE shop_domain = $3 AND session_id = $4",
        [d.country || null, d.regionName || null, shopDomain, sid]
      );
    }
  } catch (e) {}
}

router.post("/event", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(204).end(); // responder rápido, procesar async
  const { shop, sid, type, field, value, formData, url } = req.body || {};
  if (!shop || !sid || !type) return;
  const clientIp = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || null;

  try {
    const shopRow = await db.get(
      "SELECT id, user_id, shop_name, notification_color FROM shops WHERE LOWER(shop_domain) = $1 AND status = 'active'",
      [shop.toLowerCase()]
    );
    if (!shopRow) return;

    // "En vivo" ya no depende del formulario: el estado ahora distingue
    // "browsing" (en la tienda, en cualquier página) de los pasos del
    // formulario. "form_abandon" (cerró el formulario) ya NO es un estado
    // final -- vuelve a "browsing" porque el cliente sigue en la tienda.
    // Solo "page_abandon" (cerró la pestaña / se fue del sitio) termina la
    // sesión de verdad. "heartbeat" no cambia el estado, solo refresca
    // updated_at para que el latido de presencia mantenga viva la sesión.
    const status = type === "form_submit"   ? "submitted"
                 : type === "page_abandon"  ? "page_abandoned"
                 : type === "form_abandon"  ? "browsing"
                 : type === "form_open"     ? "open"
                 : type === "field_blur"    ? "filling"
                 : type === "page_view"     ? "browsing"
                 : type === "heartbeat"     ? null
                 : "browsing";

    // Upsert sesión (último estado — lo que usa el contador "en vivo")
    await db.run(
      `INSERT INTO checkout_sessions (shop_domain, user_id, session_id, status, form_data, page_url)
       VALUES ($1, $2, $3, COALESCE($4, 'browsing'), $5, $6)
       ON CONFLICT (shop_domain, session_id) DO UPDATE SET
         status    = CASE WHEN checkout_sessions.status = 'submitted' THEN 'submitted'
                          WHEN $4 IS NULL THEN checkout_sessions.status
                          ELSE $4 END,
         form_data = CASE WHEN EXCLUDED.form_data::text != '{}'
                          THEN EXCLUDED.form_data ELSE checkout_sessions.form_data END,
         updated_at = NOW()`,
      [shop.toLowerCase(), shopRow.user_id, sid, status,
       JSON.stringify(formData || {}), url || null]
    );

    if (type === "page_view") geolocateSession(shop.toLowerCase(), sid, clientIp);

    // Cronología de la sesión (lo que arma "Sesión 1: entró, abrió el
    // formulario, rellenó X, abandonó/envió") — se omiten field_focus (sin
    // valor, no aporta nada) y heartbeat (cada 20s, solo generaría ruido).
    if (type !== "field_focus" && type !== "heartbeat") {
      await db.run(
        `INSERT INTO checkout_session_events (user_id, shop_domain, session_id, type, field, value)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [shopRow.user_id, shop.toLowerCase(), sid, type, field || null, value || null]
      );
    }

    // Emitir evento SSE al dueño de la tienda
    sseManager.emitToUser(shopRow.user_id, {
      type: "cod_event",
      eventType: type,
      shop: shopRow.shop_name || shop,
      shopDomain: shop,
      sid,
      field: field || null,
      value: value || null,
      formData: formData || {},
      color: shopRow.notification_color || "#3b82f6",
    });
  } catch (e) {
    console.error("[COD Tracker] error:", e.message);
  }
});

// Si el cliente cierra la pestaña de un modo que el "pagehide" del script no
// alcanza a avisar (navegador raro, proceso matado, etc.), o simplemente deja
// la pestaña en segundo plano sin cerrarla (común en compras por el móvil
// desde un anuncio: vuelve a Instagram/Facebook y no regresa), la sesión se
// queda trabada en open/filling para siempre. Se marca como abandonada
// cualquiera sin actividad hace más de 3 minutos -- mismo criterio que ya usaba
// el contador "en vivo" de /stats, para que la lista y el contador coincidan.
async function expireStaleSessions(userId) {
  try {
    const expired = await db.all(
      `UPDATE checkout_sessions SET status = 'page_abandoned', updated_at = updated_at
       WHERE user_id = $1 AND status IN ('browsing','open','filling') AND updated_at < NOW() - INTERVAL '3 minutes'
       RETURNING session_id, shop_domain`,
      [userId]
    );
    for (const s of expired) {
      await db.run(
        `INSERT INTO checkout_session_events (user_id, shop_domain, session_id, type)
         VALUES ($1, $2, $3, 'auto_timeout')`,
        [userId, s.shop_domain, s.session_id]
      ).catch(() => {});
    }
  } catch (e) {}
}

// ── Listar sesiones con su cronología completa (auth) ───────────────────────────
router.get("/sessions", auth, async (req, res) => {
  const userId = req.user.id;
  const { shop, status, limit = 100 } = req.query;
  try {
    await expireStaleSessions(userId);
    let q = `SELECT session_id, shop_domain, status, form_data, page_url, country, region, created_at, updated_at
             FROM checkout_sessions WHERE user_id = $1`;
    const params = [userId];
    if (shop) { q += ` AND shop_domain = $${params.length + 1}`; params.push(shop); }
    if (status) { q += ` AND status = $${params.length + 1}`; params.push(status); }
    q += ` ORDER BY updated_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(parseInt(limit) || 100, 500));
    const rows = await db.all(q, params);

    if (rows.length) {
      const sessionIds = [...new Set(rows.map(r => r.session_id))];
      const events = await db.all(
        `SELECT session_id, type, field, value, created_at FROM checkout_session_events
         WHERE user_id = $1 AND session_id = ANY($2::text[]) ORDER BY created_at ASC`,
        [userId, sessionIds]
      );
      const bySession = {};
      for (const e of events) (bySession[e.session_id] ||= []).push(e);
      for (const r of rows) r.events = bySession[r.session_id] || [];
    }

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Estadísticas rápidas ───────────────────────────────────────────────────────
router.get("/stats", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    await expireStaleSessions(userId);
    // "abandonados" y "enviados" son del día de hoy en hora España (se
    // reinician a medianoche, igual que el resto de PROFITCOD) -- "en vivo"
    // no, porque es un estado de ahora mismo, no un total diario.
    const rows = await db.all(
      `SELECT shop_domain,
              COUNT(*) FILTER (WHERE status IN ('browsing','open','filling') AND updated_at > NOW() - INTERVAL '3 minutes') AS live,
              COUNT(*) FILTER (WHERE status='page_abandoned' AND (updated_at AT TIME ZONE 'Europe/Madrid')::date = (NOW() AT TIME ZONE 'Europe/Madrid')::date) AS abandoned,
              COUNT(*) FILTER (WHERE status='submitted' AND (updated_at AT TIME ZONE 'Europe/Madrid')::date = (NOW() AT TIME ZONE 'Europe/Madrid')::date) AS submitted
       FROM checkout_sessions WHERE user_id = $1
       GROUP BY shop_domain`,
      [userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Dashboard de la sección "Leads" (en vivo + hoy, por tienda) ───────────────
// Visitantes en vivo / formularios activos / rellenando salen de
// checkout_sessions (presencia en tiempo real). Ventas y pedidos de hoy salen
// de orders -- mismo cálculo que ya usa Gastos Ads (facturación ya restando
// cancelados del día, pedidos sin contar cancelados).
router.get("/leads-dashboard", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    await expireStaleSessions(userId);

    const shops = await db.all(
      "SELECT shop_domain, shop_name FROM shops WHERE user_id = $1 AND status = 'active' ORDER BY shop_name ASC",
      [userId]
    );
    if (!shops.length) return res.json([]);

    const sessionRows = await db.all(
      `SELECT shop_domain,
              COUNT(*) FILTER (WHERE status IN ('browsing','open','filling') AND updated_at > NOW() - INTERVAL '3 minutes') AS visitantes_vivo,
              COUNT(*) FILTER (WHERE status = 'open'    AND updated_at > NOW() - INTERVAL '3 minutes') AS formularios_activos,
              COUNT(*) FILTER (WHERE status = 'filling' AND updated_at > NOW() - INTERVAL '3 minutes') AS rellenando,
              COUNT(*) FILTER (WHERE status = 'submitted' AND (updated_at AT TIME ZONE 'Europe/Madrid')::date = (NOW() AT TIME ZONE 'Europe/Madrid')::date) AS compras_hoy,
              COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'Europe/Madrid')::date = (NOW() AT TIME ZONE 'Europe/Madrid')::date) AS sesiones_hoy
       FROM checkout_sessions WHERE user_id = $1
       GROUP BY shop_domain`,
      [userId]
    );
    const sessionMap = {};
    sessionRows.forEach(r => { sessionMap[r.shop_domain] = r; });

    // Mismo cálculo que la tabla de Gastos Ads: ingresos/pedidos por día de
    // CREACIÓN del pedido, y el descuento de cancelados por día en que se
    // CANCELÓ (puede ser un pedido creado otro día y cancelado hoy).
    const shopFilter = `(o.shop_id IN (SELECT id FROM shops WHERE user_id = $1)
      OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))`;
    const ingresosRows = await db.all(
      `SELECT COALESCE(o.shop_domain, s.shop_domain) AS shop_domain,
              COALESCE(SUM(o.total_price), 0) AS ingresos_hoy,
              COUNT(*) FILTER (WHERE o.fulfillment_status != 'cancelado') AS pedidos_hoy
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE ${shopFilter} AND (o.created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date = (NOW() AT TIME ZONE 'Europe/Madrid')::date
       GROUP BY COALESCE(o.shop_domain, s.shop_domain)`,
      [userId]
    );
    const descuentoRows = await db.all(
      `SELECT COALESCE(o.shop_domain, s.shop_domain) AS shop_domain,
              COALESCE(SUM(o.total_price), 0) AS descuento_hoy
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE ${shopFilter} AND o.fulfillment_status = 'cancelado' AND o.cancelled_at IS NOT NULL
         AND (o.cancelled_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date = (NOW() AT TIME ZONE 'Europe/Madrid')::date
       GROUP BY COALESCE(o.shop_domain, s.shop_domain)`,
      [userId]
    );
    const ordersMap = {};
    ingresosRows.forEach(r => { ordersMap[r.shop_domain] = { ventas_hoy: parseFloat(r.ingresos_hoy || 0), pedidos_hoy: r.pedidos_hoy }; });
    descuentoRows.forEach(r => {
      const o = ordersMap[r.shop_domain] || { ventas_hoy: 0, pedidos_hoy: 0 };
      o.ventas_hoy -= parseFloat(r.descuento_hoy || 0);
      ordersMap[r.shop_domain] = o;
    });

    const result = shops.map(s => {
      const sess = sessionMap[s.shop_domain] || {};
      const ord  = ordersMap[s.shop_domain] || {};
      return {
        shop_domain: s.shop_domain,
        shop_name: s.shop_name || s.shop_domain,
        visitantes_vivo: parseInt(sess.visitantes_vivo || 0),
        formularios_activos: parseInt(sess.formularios_activos || 0),
        rellenando: parseInt(sess.rellenando || 0),
        compras_hoy: parseInt(sess.compras_hoy || 0),
        sesiones_hoy: parseInt(sess.sesiones_hoy || 0),
        ventas_hoy: parseFloat(ord.ventas_hoy || 0),
        pedidos_hoy: parseInt(ord.pedidos_hoy || 0),
      };
    });
    res.json(result);
  } catch (e) {
    console.error("cod-tracker/leads-dashboard error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── Orden guardado de las tarjetas de tienda en Leads (por usuario) ──────────
router.get("/leads-order", auth, async (req, res) => {
  try {
    const row = await db.get("SELECT leads_order FROM users WHERE id = $1", [req.user.id]);
    let order = [];
    try { order = row?.leads_order ? JSON.parse(row.leads_order) : []; } catch (e) { order = []; }
    res.json({ order });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/leads-order", auth, async (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order)) return res.status(400).json({ error: "order debe ser un array" });
  try {
    await db.run("UPDATE users SET leads_order = $1 WHERE id = $2", [JSON.stringify(order), req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
