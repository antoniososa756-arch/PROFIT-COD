// server/cron.js — Sincronización automática en background (sin depender del navegador)
const db = require("./db");

// ── Función: sincronizar pedidos de Shopify ──────────────────────────────────
async function syncAllShopifyOrders() {
  console.log("⏰ [CRON] Iniciando sync Shopify...");
  try {
    const shops = await db.all(`SELECT id, shop_domain, access_token FROM shops WHERE status = 'active'`);
    let total = 0;
    for (const shop of shops) {
      try {
        const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // últimas 72h
        let url = `https://${shop.shop_domain}/admin/api/2024-10/orders.json?status=any&limit=250&updated_at_min=${since}`;
        while (url) {
          const r = await fetch(url, { headers: { "X-Shopify-Access-Token": shop.access_token } });
          if (!r.ok) break;
          const { orders } = await r.json();
          for (const o of orders) {
            const customerName = o.customer
              ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
              : "Desconocido";
            const fStatus = mapStatus(o);
            await db.run(
              `INSERT INTO orders (shop_id, order_id, order_number, customer_name, fulfillment_status, financial_status, tracking_number, total_price, currency, created_at, raw_json)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                              ON CONFLICT(order_id) DO UPDATE SET
                 fulfillment_status = CASE 
                   WHEN orders.fulfillment_status IN ('entregado','devuelto','destruido','cancelado') 
                   THEN orders.fulfillment_status 
                   ELSE EXCLUDED.fulfillment_status 
                 END,
                 financial_status   = EXCLUDED.financial_status,
                 tracking_number    = EXCLUDED.tracking_number,
                 total_price        = EXCLUDED.total_price,
                 raw_json           = EXCLUDED.raw_json`,
              [shop.id, String(o.id), o.name || String(o.order_number), customerName,
               fStatus, o.financial_status || null,
               o.fulfillments?.[0]?.tracking_number || null,
               o.total_price, o.currency, o.created_at, JSON.stringify(o)]
            );
            total++;
          }
          const link = r.headers.get("Link") || "";
          const next = link.match(/<([^>]+)>;\s*rel="next"/);
          url = next ? next[1] : null;
        }
      } catch(e) { console.error(`[CRON] Error shop ${shop.shop_domain}:`, e.message); }
    }
    console.log(`✅ [CRON] Shopify sync: ${total} pedidos procesados`);
  } catch(e) { console.error("[CRON] Error sync Shopify:", e.message); }
}

function mapStatus(o) {
  if (o.cancelled_at) return "cancelado";
  const f = o.fulfillment_status;
  if (!f || f === "unfulfilled") return "pendiente";
  if (f === "fulfilled") return "enviado";
  if (f === "partial") return "en_preparacion";
  return f;
}

// ── Función: sincronizar MRW para todos los usuarios ────────────────────────
function mapMRWStatus(texto) {
  const t = (texto || "").toLowerCase();
  if (t.includes("entregado")) return "entregado";
  if (t.includes("devuelto")) return "devuelto";
  if (t.includes("destruir") || t.includes("destruido")) return "destruido";
  if (t.includes("pendiente de recoger en franquicia")) return "franquicia";
  if (t.includes("pendiente de recoger")) return "pendiente";
  return "en_transito";
}

async function syncAllMRW() {
  if (global.__cronMRWRunning) { console.log("[CRON] MRW ya en curso, saltando"); return; }
  global.__cronMRWRunning = true;
  console.log("⏰ [CRON] Iniciando sync MRW...");
  try {
    const credsList = await db.all(`SELECT * FROM mrw_credentials`);
    if (!credsList.length) { console.log("[CRON] Sin credenciales MRW"); return; }

    for (const creds of credsList) {
      try {
        const pedidos = await db.all(
          `SELECT o.id, o.tracking_number, o.fulfillment_status
           FROM orders o
           JOIN shops s ON s.id = o.shop_id
           WHERE s.user_id = $1
             AND o.tracking_number IS NOT NULL
             AND o.tracking_number != ''
             AND o.fulfillment_status NOT IN ('entregado','devuelto','destruido','cancelado')
           ORDER BY o.last_mrw_check ASC NULLS FIRST
           LIMIT 170`,
          [creds.user_id]
        );
        if (!pedidos.length) continue;

        let updated = 0;
        for (const pedido of pedidos) {
          try {
            await new Promise(r => setTimeout(r, 140));
            const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:GetEnvios>
      <tem:login>${creds.login}</tem:login>
      <tem:pass>${creds.pass}</tem:pass>
      <tem:codigoIdioma>3082</tem:codigoIdioma>
      <tem:tipoFiltro>0</tem:tipoFiltro>
      <tem:valorFiltroDesde>${pedido.tracking_number}</tem:valorFiltroDesde>
      <tem:valorFiltroHasta>${pedido.tracking_number}</tem:valorFiltroHasta>
      <tem:fechaDesde></tem:fechaDesde>
      <tem:fechaHasta></tem:fechaHasta>
      <tem:tipoInformacion>0</tem:tipoInformacion>
    </tem:GetEnvios>
  </soapenv:Body>
</soapenv:Envelope>`;

            const res = await fetch("https://trackingservice.mrw.es/TrackingService.svc/TrackingServices", {
              method: "POST",
              headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "http://tempuri.org/ITrackingService/GetEnvios" },
              body: soapBody,
              signal: AbortSignal.timeout(10000)
            });
            const xml = await res.text();
            await db.run("UPDATE orders SET last_mrw_check = now()::text WHERE id = $1", [pedido.id]);

            const estadoMatch = xml.match(/<[^:]*:?EstadoDescripcion[^>]*>([^<]+)<\/[^:]*:?EstadoDescripcion>/);
            if (!estadoMatch) continue;

            const nuevoStatus = mapMRWStatus(estadoMatch[1].trim());
            console.log(`[MRW CRON] ${pedido.tracking_number} → ${nuevoStatus}`);
            if (nuevoStatus !== pedido.fulfillment_status) {
              await db.run(`UPDATE orders SET fulfillment_status = $1, updated_at = now()::text WHERE id = $2`, [nuevoStatus, pedido.id]);
              updated++;
            }
          } catch(e) { console.error(`[CRON] MRW pedido ${pedido.tracking_number}:`, e.message); }
        }
        console.log(`✅ [CRON] MRW user ${creds.user_id}: ${updated} pedidos actualizados de ${pedidos.length}`);
      } catch(e) { console.error(`[CRON] MRW error user ${creds.user_id}:`, e.message); }
    }
  } catch(e) { console.error("[CRON] Error sync MRW:", e.message); }
  finally { global.__cronMRWRunning = false; }
}

// ── Función: sincronizar PDFs de MRW via Gmail para todos los usuarios ───────
async function syncAllGmailPDF() {
  console.log("⏰ [CRON] Iniciando sync Gmail PDF MRW...");
  const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
  const pdfParse = require("pdf-parse");

  async function refreshToken(userId, refreshTok) {
    const CLIENT_ID     = process.env.GMAIL_CLIENT_ID;
    const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshTok,
        grant_type:    "refresh_token",
      }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error("No se pudo refrescar token Gmail");
    await db.run(
      "UPDATE gmail_config SET access_token = ? WHERE user_id = ?",
      [data.access_token, userId]
    );
    return data.access_token;
  }

  async function gmailFetch(userId, url, options = {}) {
    const row = await db.get(
      "SELECT access_token, refresh_token FROM gmail_config WHERE user_id = ?",
      [userId]
    );
    let token = row.access_token;
    let res = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    if (res.status === 401) {
      token = await refreshToken(userId, row.refresh_token);
      res = await fetch(url, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
      });
    }
    return res;
  }

  function parsearPDFMRW(texto) {
    const registros = [];
    const reGlobal = /04700[A-Z]\d{6}/g;
    let match;
    while ((match = reGlobal.exec(texto)) !== null) {
      registros.push({ nEnvio: match[0] });
    }
    return registros;
  }

  try {
    const usuarios = await db.all(
      "SELECT user_id FROM gmail_config WHERE connected = 1"
    );
    if (!usuarios.length) {
      console.log("[CRON] Sin usuarios con Gmail conectado");
      return;
    }

    for (const { user_id } of usuarios) {
      try {
        const query = encodeURIComponent(
          'from:onlinefact@mrw.es subject:"Factura de Reembolsos" has:attachment filename:pdf newer_than:40d'
        );
        const listRes = await gmailFetch(
          user_id,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`
        );
        const listData = await listRes.json();
        const messages = listData.messages || [];
        if (!messages.length) {
          console.log(`[CRON] Gmail user ${user_id}: sin emails nuevos MRW`);
          continue;
        }

        let totalMarcados = 0;
        for (const msg of messages) {
          try {
            const msgRes = await gmailFetch(
              user_id,
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`
            );
            const msgData = await msgRes.json();
            const partes = msgData.payload?.parts || [];
            const pdfs = partes.filter(p =>
              p.mimeType === "application/pdf" || p.filename?.toLowerCase().endsWith(".pdf")
            );

            for (const parte of pdfs) {
              const attachId = parte.body?.attachmentId;
              if (!attachId) continue;
              const attRes = await gmailFetch(
                user_id,
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${attachId}`
              );
              const attData = await attRes.json();
              const pdfBuffer = Buffer.from(attData.data, "base64url");
              const parsed = await pdfParse(pdfBuffer);
              const registros = parsearPDFMRW(parsed.text);

              for (const { nEnvio } of registros) {
                if (!nEnvio) continue;
                // Buscar el pedido por tracking_number dentro de las tiendas del usuario
                const order = await db.get(
                  `SELECT o.id FROM orders o
                   JOIN shops s ON s.id = o.shop_id
                   WHERE o.tracking_number = ? AND s.user_id = ?`,
                  [nEnvio, user_id]
                );
                if (!order) continue;
                await db.run(
                  `INSERT INTO reembolsos_estado (user_id, order_id, estado)
                   VALUES (?, ?, 'cobrado')
                   ON CONFLICT (user_id, order_id) DO UPDATE SET estado = 'cobrado'`,
                  [user_id, String(order.id)]
                );
                totalMarcados++;
              }
            }
          } catch(e) { console.error(`[CRON] Gmail msg ${msg.id} user ${user_id}:`, e.message); }
        }
        console.log(`✅ [CRON] Gmail PDF user ${user_id}: ${totalMarcados} reembolsos marcados cobrados`);
      } catch(e) { console.error(`[CRON] Gmail PDF error user ${user_id}:`, e.message); }
    }
  } catch(e) { console.error("[CRON] Error sync Gmail PDF:", e.message); }
}

// ── Arrancar los crons ───────────────────────────────────────────────────────
function startCrons() {
  // Sync Shopify cada 10 minutos
  setInterval(syncAllShopifyOrders, 10 * 60 * 1000);
  // Sync MRW cada 5 minutos
  setInterval(syncAllMRW, 5 * 60 * 1000);

  // También ejecutar una vez al arrancar (después de 30s para que la DB esté lista)
  setTimeout(syncAllShopifyOrders, 30 * 1000);
  setTimeout(syncAllMRW, 60 * 1000);

  console.log("✅ [CRON] Crons iniciados — Shopify cada 10min, MRW cada 5min");

  // ── Cierre de mes: comprobar cada hora si toca generar factura y resetear contadores ──
  setInterval(async () => {
    const now = new Date();
    if (now.getDate() !== 1 || now.getHours() !== 2) return; // Solo el día 1 a las 2:00
    try {
      const { PLANS } = require("./routes/billing.routes");
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const period = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
      const users = await db.all(
        `SELECT id, plan, plan_status FROM users WHERE plan_status = 'active' AND plan != 'free'`
      );
      // Cargar config de Stripe para cobrar cargos variables
      let stripe = null;
      try {
        const { PLANS: _p } = require("./routes/billing.routes");
        const cfgRow = await db.get("SELECT stripe_secret_key FROM payment_config WHERE id = 1");
        const stripeKey = cfgRow?.stripe_secret_key || process.env.STRIPE_SECRET_KEY || "";
        if (stripeKey) stripe = require("stripe")(stripeKey);
      } catch(e) { console.error("[BILLING] No se pudo cargar Stripe:", e.message); }

      for (const user of users) {
        try {
          const planInfo = PLANS[user.plan];
          if (!planInfo) continue;
          const countRow = await db.get(
            `SELECT COUNT(*) as cnt FROM orders o
             WHERE (o.shop_id IN (SELECT id FROM shops WHERE user_id = $1) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
               AND o.created_at LIKE $2`,
            [user.id, period + "%"]
          );
          const ordersUsed = parseInt(countRow?.cnt || 0);
          const variableCost = +(ordersUsed * planInfo.price_per_order).toFixed(2);
          const total = +(planInfo.base_price + variableCost).toFixed(2);

          // Guardar factura en DB
          await db.run(
            `INSERT INTO billing_invoices (user_id, plan, period, base_price, orders_used, price_per_order, variable_cost, total)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id, period) DO NOTHING`,
            [user.id, user.plan, period, planInfo.base_price, ordersUsed, planInfo.price_per_order, variableCost, total]
          );

          // Añadir cargo variable en Stripe si hay pedidos extra y el cliente tiene suscripción
          if (stripe && variableCost > 0) {
            const userRow = await db.get(
              "SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1", [user.id]
            );
            if (userRow?.stripe_customer_id && userRow?.stripe_subscription_id) {
              await stripe.invoiceItems.create({
                customer:     userRow.stripe_customer_id,
                subscription: userRow.stripe_subscription_id,
                amount:       Math.round(variableCost * 100), // céntimos
                currency:     "eur",
                description:  `Pedidos extra ${period}: ${ordersUsed} pedidos × ${planInfo.price_per_order}€`,
              });
              console.log(`[BILLING] Cargo variable Stripe: user ${user.id} — ${variableCost}€ (${ordersUsed} pedidos)`);
            }
          }

          // Resetear caché del mes anterior
          await db.run(
            `UPDATE users SET monthly_orders_cache = 0, monthly_orders_month = $1,
             billing_cycle_start = $2 WHERE id = $3`,
            [period.slice(0, 7), new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), user.id]
          );
          console.log(`[BILLING] Factura ${period} generada para user ${user.id}: ${total}€`);
        } catch(e) { console.error(`[BILLING] Error user ${user.id}:`, e.message); }
      }
    } catch(e) { console.error("[BILLING] Error cierre de mes:", e.message); }
  }, 60 * 60 * 1000); // cada hora

  // Sync Gmail PDF MRW: cada hora comprobamos si son las 3am para ejecutar
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() !== 3) return; // Solo a las 3:00am
    await syncAllGmailPDF();
  }, 60 * 60 * 1000); // cada hora

  // También ejecutar una vez al arrancar (después de 90s)
  setTimeout(syncAllGmailPDF, 90 * 1000);

  // Keep-alive: ping cada 10 min para que Render no duerma el servidor
  const APP_URL = process.env.APP_URL || "https://profit-cod.onrender.com";
  setInterval(async () => {
    try {
      await fetch(`${APP_URL}/api/health`);
      console.log("💓 [KEEP-ALIVE] ping ok");
    } catch(e) { console.log("💓 [KEEP-ALIVE] ping error:", e.message); }
  }, 10 * 60 * 1000);
}

module.exports = { startCrons };