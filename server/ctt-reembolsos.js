// server/ctt-reembolsos.js — Reembolsos COD pagados por CTT Express, leídos
// de Gmail.
//
// A diferencia de MRW (que adjunta un PDF), CTT manda el "JUSTIFICANTE DE
// PAGO DE REEMBOLSO" desde notificaciones@contact.cttexpress.com con el
// detalle EN EL CUERPO del correo: una fila por albarán (nº de seguimiento de
// 22 dígitos, ej. 0050040050049700884424), destinatario, referencia e
// importe. Se extraen esos albaranes y se marcan los pedidos como cobrados,
// igual que hace la integración de MRW.

const CTT_GMAIL_QUERY = "from:contact.cttexpress.com reembolso";

// Albaranes CTT: exactamente 22 dígitos seguidos (sin más dígitos pegados).
function extraerAlbaranesCTT(texto) {
  const set = new Set();
  const re = /(?<!\d)\d{22}(?!\d)/g;
  let m;
  while ((m = re.exec(texto || "")) !== null) set.add(m[0]);
  return [...set];
}

// Texto plano de un mensaje de Gmail (format=full): junta todas las partes
// text/plain y text/html (decodificadas, sin etiquetas HTML).
function textoDeMensajeGmail(msgData) {
  const trozos = [];
  (function recorrer(part) {
    if (!part) return;
    const mime = part.mimeType || "";
    if ((mime === "text/plain" || mime === "text/html") && part.body?.data) {
      let t = Buffer.from(part.body.data, "base64url").toString("utf8");
      if (mime === "text/html") t = t.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
      trozos.push(t);
    }
    (part.parts || []).forEach(recorrer);
  })(msgData.payload);
  return trozos.join("\n");
}

// Marca como cobrados los pedidos del usuario con esos albaranes. Devuelve
// cuántos pedidos encontró. Mismo filtro de tienda "por shop_id O por
// dominio" que usa MRW para no perder pedidos de tiendas reconectadas.
async function marcarCobradosCTT(db, userId, albaranes, fecha) {
  let marcados = 0;
  for (const albaran of albaranes) {
    const order = await db.get(
      `SELECT o.id FROM orders o
       WHERE btrim(o.tracking_number) = $1
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $2)
           OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2))`,
      [albaran, userId]
    );
    if (!order) continue;
    await db.run(
      `INSERT INTO reembolsos_estado (user_id, order_id, tracking_number, estado, fecha_pago)
       VALUES ($1, $2, $3, 'cobrado', $4)
       ON CONFLICT (user_id, order_id) DO UPDATE SET estado = 'cobrado', fecha_pago = COALESCE(reembolsos_estado.fecha_pago, EXCLUDED.fecha_pago)`,
      [userId, String(order.id), albaran, fecha]
    );
    marcados++;
  }
  return marcados;
}

// Referencias de pedido del justificante (columna REFERENCIA, ej.
// "#COMFORT58661") -- plan B cuando el albarán no coincide con el
// seguimiento guardado del pedido (pedidos de CTT sin seguimiento en Shopify).
function extraerReferenciasCTT(texto) {
  const set = new Set();
  const re = /#[A-Za-z]+[A-Za-z0-9-]*\d/g;
  let m;
  while ((m = re.exec(texto || "")) !== null) set.add(m[0].toUpperCase());
  return [...set];
}

// Procesa el texto de UN justificante de pago de CTT: marca como cobrados los
// pedidos por albarán y, los que no aparezcan así, por referencia. Devuelve el
// detalle para el diagnóstico de la pantalla.
async function procesarJustificanteCTT(db, userId, texto, fecha) {
  const albaranes = extraerAlbaranesCTT(texto);
  const refs = extraerReferenciasCTT(texto);
  const marcados = new Set();
  const porAlbaran = [];
  for (const albaran of albaranes) {
    const order = await db.get(
      `SELECT o.id FROM orders o
       WHERE btrim(o.tracking_number) = $1
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $2)
           OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2))`,
      [albaran, userId]
    );
    if (order) { marcados.add(order.id); porAlbaran.push(albaran); await marcarCobradoId(db, userId, order.id, albaran, fecha); }
  }
  const porRef = [];
  for (const ref of refs) {
    const order = await db.get(
      `SELECT o.id, o.tracking_number FROM orders o
       WHERE upper(btrim(o.order_number)) = $1
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $2)
           OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2))`,
      [ref, userId]
    );
    if (order && !marcados.has(order.id)) {
      marcados.add(order.id); porRef.push(ref);
      await marcarCobradoId(db, userId, order.id, order.tracking_number || null, fecha);
    }
  }
  return {
    albaranes, refs,
    encontrados: marcados.size,
    albaranesSinPedido: albaranes.filter((a) => !porAlbaran.includes(a)),
    porReferencia: porRef,
    // Si no salió nada, un trozo del texto para ver qué está llegando
    muestra: albaranes.length || refs.length ? undefined : String(texto || "").replace(/\s+/g, " ").slice(0, 400),
  };
}

async function marcarCobradoId(db, userId, orderId, tracking, fecha) {
  await db.run(
    `INSERT INTO reembolsos_estado (user_id, order_id, tracking_number, estado, fecha_pago)
     VALUES ($1, $2, $3, 'cobrado', $4)
     ON CONFLICT (user_id, order_id) DO UPDATE SET estado = 'cobrado', fecha_pago = COALESCE(reembolsos_estado.fecha_pago, EXCLUDED.fecha_pago)`,
    [userId, String(orderId), tracking, fecha]
  );
}

// Recorre los correos de reembolsos de CTT en Gmail del usuario.
// gmailFetch(url) -> Response ya autenticada (cada llamador pasa la suya).
// extraQuery: ej. "newer_than:40d" (cron) o "after:2025/1/1" (botón manual).
async function syncCTTReembolsosGmail(db, userId, gmailFetch, extraQuery = "newer_than:40d") {
  const q = encodeURIComponent(`${CTT_GMAIL_QUERY} ${extraQuery}`.trim());
  const listRes = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=100`);
  const listData = await listRes.json();
  const messages = listData.messages || [];
  const toMadridDate = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);

  let albaranesTotal = 0, marcados = 0;
  const errores = [];
  for (const msg of messages) {
    try {
      const msgRes = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`);
      const msgData = await msgRes.json();
      const texto = textoDeMensajeGmail(msgData);
      // Solo los justificantes de pago (CTT manda más tipos de aviso).
      if (!/reembolso/i.test(texto)) continue;
      const fecha = msgData.internalDate ? toMadridDate(new Date(parseInt(msgData.internalDate))) : toMadridDate(new Date());
      const d = await procesarJustificanteCTT(db, userId, texto, fecha);
      albaranesTotal += d.albaranes.length;
      marcados += d.encontrados;
    } catch (e) {
      errores.push({ msgId: msg.id, error: e.message });
    }
  }
  return { emailsLeidos: messages.length, albaranes: albaranesTotal, procesados: marcados, errores };
}

module.exports = { extraerAlbaranesCTT, extraerReferenciasCTT, procesarJustificanteCTT, marcarCobradosCTT, syncCTTReembolsosGmail, CTT_GMAIL_QUERY };
