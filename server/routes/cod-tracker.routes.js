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

  const script = `/* PROFIT-COD COD Tracker v1 — ${shop} */
(function(){
  var SHOP="${shop}", API="${appUrl}";
  var sid=sessionStorage.getItem("_pc_sid");
  if(!sid){sid=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem("_pc_sid",sid);}
  var fd={}, tracked=false;
  var FM={
    "Nombre y apellidos":"nombre","Teléfono":"telefono",
    "Dirección (Calle y número)":"direccion","Casa, Piso, Local...":"direccion2",
    "Ciudad":"ciudad","Código postal":"cp","Email (opcional)":"email",
    "Nombre":"nombre","Phone":"telefono","Address":"direccion","City":"ciudad","Zip":"cp","Email":"email"
  };
  function send(type,extra){
    var p=Object.assign({shop:SHOP,sid:sid,type:type,url:location.href},extra||{});
    navigator.sendBeacon?navigator.sendBeacon(API+"/api/cod-tracker/event",new Blob([JSON.stringify(p)],{type:"application/json"})):
    fetch(API+"/api/cod-tracker/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p),keepalive:true}).catch(function(){});
  }
  function fieldName(el){return FM[el.placeholder]||FM[el.name]||el.name||el.placeholder||"campo";}
  function attachForm(form){
    form.querySelectorAll("input,select,textarea").forEach(function(el){
      el.addEventListener("focus",function(){send("field_focus",{field:fieldName(el)});});
      el.addEventListener("blur",function(){
        if(el.value){fd[fieldName(el)]=el.value;send("field_blur",{field:fieldName(el),value:el.value,formData:fd});}
      });
      el.addEventListener("change",function(){
        if(el.value){fd[fieldName(el)]=el.value;send("field_blur",{field:fieldName(el),value:el.value,formData:fd});}
      });
    });
    form.addEventListener("submit",function(){send("form_submit",{formData:fd});},true);
  }
  function onModalOpen(){
    if(tracked)return; tracked=true; fd={};
    send("form_open");
    var form=document.getElementById("_rsi-cod-form-modal-form");
    if(form)attachForm(form);
  }
  function onModalClose(){
    if(!tracked)return; tracked=false;
    send("form_abandon",{formData:fd});
  }
  function watchModal(modal){
    var obs=new MutationObserver(function(){
      modal.classList.contains("_rsi-cod-form-modal-open")?onModalOpen():onModalClose();
    });
    obs.observe(modal,{attributes:true,attributeFilter:["class"]});
    if(modal.classList.contains("_rsi-cod-form-modal-open"))onModalOpen();
  }
  var m=document.getElementById("_rsi-cod-form-modal");
  if(m){watchModal(m);}else{
    var bo=new MutationObserver(function(){
      var m2=document.getElementById("_rsi-cod-form-modal");
      if(m2){bo.disconnect();watchModal(m2);}
    });
    bo.observe(document.body,{childList:true,subtree:true});
  }
})();`;

  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(script);
});

// ── Recibir evento del tracker (sin auth, viene del navegador del cliente) ─────
router.post("/event", express.json(), async (req, res) => {
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

    // Upsert sesión
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

// ── Listar sesiones (auth) ─────────────────────────────────────────────────────
router.get("/sessions", auth, async (req, res) => {
  const userId = req.user.id;
  const { shop, status, limit = 100 } = req.query;
  try {
    let q = `SELECT session_id, shop_domain, status, form_data, page_url, created_at, updated_at
             FROM checkout_sessions WHERE user_id = $1`;
    const params = [userId];
    if (shop) { q += ` AND shop_domain = $${params.length + 1}`; params.push(shop); }
    if (status) { q += ` AND status = $${params.length + 1}`; params.push(status); }
    q += ` ORDER BY updated_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(parseInt(limit) || 100, 500));
    const rows = await db.all(q, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Estadísticas rápidas ───────────────────────────────────────────────────────
router.get("/stats", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const rows = await db.all(
      `SELECT shop_domain,
              COUNT(*) FILTER (WHERE status='open' OR status='filling') AS live,
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
