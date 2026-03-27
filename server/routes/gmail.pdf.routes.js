const express  = require("express");
const router   = express.Router();
const fetch    = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
const pdfParse = require("pdf-parse");

const CLIENT_ID     = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

// ─── Refrescar access_token si ha expirado ────────────────────────────────────
async function getValidToken(db, userId) {
  const row = await db.get(
    "SELECT access_token, refresh_token FROM gmail_config WHERE user_id = ? AND connected = 1",
    [userId]
  );
  if (!row) throw new Error("Gmail no conectado");

  // Intentar con el token actual primero
  // Si falla (401) refrescamos
  return row.access_token;
}

async function refreshToken(db, userId, refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("No se pudo refrescar el token");
  await db.run(
    "UPDATE gmail_config SET access_token = ? WHERE user_id = ?",
    [data.access_token, userId]
  );
  return data.access_token;
}

// ─── Llamada a Gmail API con auto-refresh ─────────────────────────────────────
async function gmailFetch(db, userId, url, options = {}) {
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
    token = await refreshToken(db, userId, row.refresh_token);
    res = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
  }
  return res;
}

// ─── Extraer Nº Envío e Imp. a pagar del texto del PDF ───────────────────────
function parsearPDFMRW(texto) {
  const lineas = texto.split("\n");
  const registros = [];
  // Patrón: número de envío MRW (04700Fxxxxxx o similar) seguido de importe
  const reEnvio = /\b(04700[A-Z]\d{6,})\b/;
  const reImporte = /(\d{1,3}(?:,\d{2}))\s*$/;

  for (const linea of lineas) {
    const matchEnvio = linea.match(reEnvio);
    if (!matchEnvio) continue;
    const nEnvio = matchEnvio[1];
    // El importe a pagar es el último número de la línea
    const matchImporte = linea.match(reImporte);
    const importe = matchImporte ? parseFloat(matchImporte[1].replace(",", ".")) : null;
    registros.push({ nEnvio, importe });
  }
  return registros;
}

// ─── POST /api/gmail/sync-pdf ────────────────────────────────────────────────
// Lee emails de MRW en Gmail, descarga PDFs y marca reembolsos como cobrados
router.post("/sync-pdf", async (req, res) => {
  const userId = req.user.id;
  const db = req.db;

  try {
    // 1. Buscar emails de MRW con PDF adjunto (desde 2025-01-01)
    const query = encodeURIComponent(
      'from:onlinefact@mrw.es subject:"Factura de Reembolsos" has:attachment filename:pdf after:2025/1/1'
    );
    const listRes = await gmailFetch(
      db, userId,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=100`
    );
    const listData = await listRes.json();
    const messages = listData.messages || [];

    if (messages.length === 0) {
      return res.json({ ok: true, procesados: 0, emailsLeidos: 0, pdfsProcesados: 0, enviosEncontrados: 0 });
    }

    let totalMarcados = 0;
    let totalPDFs = 0;
    let totalEnvios = 0;
    const errores = [];

    for (const msg of messages) {
      try {
        // 2. Obtener detalle del email
        const msgRes = await gmailFetch(
          db, userId,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`
        );
        const msgData = await msgRes.json();

        // 3. Encontrar adjuntos PDF (buscar también en partes anidadas)
        const todasPartes = [];
        function recogerPartes(parts) {
          for (const p of parts || []) {
            todasPartes.push(p);
            if (p.parts) recogerPartes(p.parts);
          }
        }
        recogerPartes(msgData.payload?.parts || []);
        const pdfs = todasPartes.filter(p =>
          p.mimeType === "application/pdf" ||
          p.filename?.toLowerCase().endsWith(".pdf")
        );

        for (const parte of pdfs) {
          const attachId = parte.body?.attachmentId;
          if (!attachId) continue;
          totalPDFs++;

          // 4. Descargar el PDF
          const attRes = await gmailFetch(
            db, userId,
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${attachId}`
          );
          const attData = await attRes.json();
          const pdfBuffer = Buffer.from(attData.data, "base64url");

          // 5. Parsear el PDF
          const parsed = await pdfParse(pdfBuffer);
          const registros = parsearPDFMRW(parsed.text);
          totalEnvios += registros.length;

          // 6. Marcar cada pedido como cobrado en la BD
          for (const { nEnvio } of registros) {
            if (!nEnvio) continue;
            // Buscar el pedido por tracking_number (orders no tiene user_id directo, va por shop)
            const order = await db.get(
              `SELECT o.id FROM orders o
               JOIN shops s ON s.id = o.shop_id
               WHERE o.tracking_number = ? AND s.user_id = ?`,
              [nEnvio, userId]
            );
            if (!order) continue;

            // Marcar como cobrado en reembolsos_estado (tabla correcta, sin 's')
            await db.run(
              `INSERT INTO reembolsos_estado (user_id, order_id, estado)
               VALUES (?, ?, 'cobrado')
               ON CONFLICT (user_id, order_id) DO UPDATE SET estado = 'cobrado'`,
              [userId, String(order.id)]
            );
            totalMarcados++;
          }
        }
      } catch (e) {
        errores.push({ msgId: msg.id, error: e.message });
      }
    }

    res.json({
      ok: true,
      emailsLeidos: messages.length,
      pdfsProcesados: totalPDFs,
      enviosEncontrados: totalEnvios,
      procesados: totalMarcados,
      errores,
    });

  } catch (e) {
    console.error("gmail sync-pdf error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
