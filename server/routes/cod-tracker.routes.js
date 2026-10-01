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

  const script = `/* PROFIT-COD COD Tracker v3 */
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
  // lo maneje la app por dentro.
  function checkState(){
    var modal=document.getElementById("_rsi-cod-form-modal");
    var isOpen=!!(modal&&modal.classList.contains("_rsi-cod-form-modal-open"));
    if(isOpen&&!tracked){
      tracked=true; fd={};
      send("form_open");
      var form=document.getElementById("_rsi-cod-form-modal-form");
      if(form)attachForm(form);
    } else if(!isOpen&&tracked){
      tracked=false; attachedForm=null;
      send("form_abandon",{formData:fd});
    }
  }
  checkState();
  setInterval(checkState,700);
  // Si cierra la pestaña o navega fuera de la página con el formulario
  // todavía abierto, el script se mata de golpe y nunca llega a detectar el
  // cierre por el polling de arriba -- se manda un último aviso justo antes.
  addEventListener("pagehide",function(){
    if(tracked){tracked=false;send("form_abandon",{formData:fd});}
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
router.post("/event", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(204).end(); // responder rápido, procesar async
  const { shop, sid, type, field, value, formData, url } = req.body || {};
  if (!shop || !sid || !type) return;

  try {
    const shopRow = await db.get(
      "SELECT id, user_id, shop_name, notification_color FROM shops WHERE LOWER(shop_domain) = $1 AND status = 'active'",
      [shop.toLowerCase()]
    );
    if (!shopRow) return;

    const status = type === "form_submit" ? "submitted"
                 : type === "form_abandon" ? "abandoned"
                 : type === "form_open"    ? "open"
                 : "filling";

    // Upsert sesión (último estado — lo que usa el contador "en vivo")
    await db.run(
      `INSERT INTO checkout_sessions (shop_domain, user_id, session_id, status, form_data, page_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (shop_domain, session_id) DO UPDATE SET
         status    = CASE WHEN checkout_sessions.status = 'submitted' THEN 'submitted'
                          ELSE EXCLUDED.status END,
         form_data = CASE WHEN EXCLUDED.form_data::text != '{}'
                          THEN EXCLUDED.form_data ELSE checkout_sessions.form_data END,
         updated_at = NOW()`,
      [shop.toLowerCase(), shopRow.user_id, sid, status,
       JSON.stringify(formData || {}), url || null]
    );

    // Cronología de la sesión (lo que arma "Sesión 1: abrió, rellenó X,
    // abandonó/envió") — se omite field_focus a propósito, sin valor todavía
    // no aporta nada a la cronología y solo genera ruido.
    if (type !== "field_focus") {
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
// alcanza a avisar (navegador raro, proceso matado, etc.), la sesión se queda
// trabada en open/filling para siempre. Se marca como abandonada cualquiera
// sin actividad hace más de 10 minutos -- mismo criterio que ya usaba el
// contador "en vivo" de /stats, para que la lista y el contador coincidan.
async function expireStaleSessions(userId) {
  try {
    const expired = await db.all(
      `UPDATE checkout_sessions SET status = 'abandoned', updated_at = updated_at
       WHERE user_id = $1 AND status IN ('open','filling') AND updated_at < NOW() - INTERVAL '10 minutes'
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
    let q = `SELECT session_id, shop_domain, status, form_data, page_url, created_at, updated_at
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
    const rows = await db.all(
      `SELECT shop_domain,
              COUNT(*) FILTER (WHERE (status='open' OR status='filling') AND updated_at > NOW() - INTERVAL '10 minutes') AS live,
              COUNT(*) FILTER (WHERE status='abandoned') AS abandoned,
              COUNT(*) FILTER (WHERE status='submitted') AS submitted,
              COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours') AS today
       FROM checkout_sessions WHERE user_id = $1
       GROUP BY shop_domain`,
      [userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
