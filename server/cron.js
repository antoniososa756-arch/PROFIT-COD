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
async function syncAllMRW() {
  console.log("⏰ [CRON] Iniciando sync MRW...");
  try {
    const credsList = await db.all(`SELECT * FROM mrw_credentials`);
    if (!credsList.length) { console.log("[CRON] Sin credenciales MRW"); return; }

    for (const creds of credsList) {
      try {
        // Pedidos en tránsito de este usuario
        const shops = await db.all(
          `SELECT id FROM shops WHERE user_id = $1 AND status = 'active'`, [creds.user_id]
        );
        const shopIds = shops.map(s => s.id);
        if (!shopIds.length) continue;

        const pedidos = await db.all(
          `SELECT id, tracking_number FROM orders 
           WHERE shop_id = ANY($1::int[]) 
           AND fulfillment_status IN ('enviado','en_transito','en_preparacion','franquicia')
           AND tracking_number IS NOT NULL`,
          [shopIds]
        );

        let updated = 0;
        for (const pedido of pedidos) {
          try {
            const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetEstadoEnvio xmlns="http://www.mrw.es/TrackingService/">
      <request>
        <Login>${creds.login}</Login>
        <Password>${creds.password}</Password>
        <Franquicia>${creds.franquicia || ""}</Franquicia>
        <Abonado>${creds.abonado || ""}</Abonado>
        <NumeroEnvio>${pedido.tracking_number}</NumeroEnvio>
      </request>
    </GetEstadoEnvio>
  </soap:Body>
</soap:Envelope>`;

            const res = await fetch("https://www.mrw.es/TrackingService/MRWGlobalService.svc", {
              method: "POST",
              headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "http://www.mrw.es/TrackingService/IMRWGlobalService/GetEstadoEnvio" },
              body: xmlBody,
              signal: AbortSignal.timeout(10000)
            });
            if (!res.ok) continue;
            const xml = await res.text();

            let newStatus = null;
            if (xml.includes("Entregado")) newStatus = "entregado";
            else if (xml.includes("Devuelto") || xml.includes("No entregado")) newStatus = "devuelto";
            else if (xml.includes("En reparto") || xml.includes("En tránsito") || xml.includes("transito")) newStatus = "en_transito";
            else if (xml.includes("Destruido")) newStatus = "destruido";
            else if (xml.includes("Franquicia")) newStatus = "franquicia";

            if (newStatus) {
              await db.run(`UPDATE orders SET fulfillment_status = $1 WHERE id = $2`, [newStatus, pedido.id]);
              updated++;
            }
          } catch(e) { /* timeout individual, ignorar */ }
        }
        console.log(`✅ [CRON] MRW user ${creds.user_id}: ${updated} pedidos actualizados de ${pedidos.length}`);
      } catch(e) { console.error(`[CRON] MRW error user ${creds.user_id}:`, e.message); }
    }
  } catch(e) { console.error("[CRON] Error sync MRW:", e.message); }
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