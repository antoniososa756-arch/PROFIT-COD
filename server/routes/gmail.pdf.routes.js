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

async function refreshToken(db, userId, refreshTok) {
  if (!refreshTok) throw new Error("GMAIL_RECONNECT");
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
  if (!data.access_token) throw new Error("GMAIL_RECONNECT");
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
  const registros = [];
  // Buscar todos los Nº Envío en el texto completo (sin word boundary, el número va pegado a texto)
  // Formato: 04700 + letra + 6 dígitos, ej: 04700F640701
  const reGlobal = /04700[A-Z]\d{6}/g;
  let match;
  while ((match = reGlobal.exec(texto)) !== null) {
    registros.push({ nEnvio: match[0] });
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
        // Fecha del email en zona horaria española (el servidor corre en UTC)
        const toMadridDate = d => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
        const emailFecha = msgData.internalDate
          ? toMadridDate(new Date(parseInt(msgData.internalDate)))
          : toMadridDate(new Date());

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
          // Debug: loguear muestra del texto para ajustar regex
          console.log(`[PDF DEBUG] Muestra texto (primeros 800 chars):\n${parsed.text.slice(0, 800)}`);
          const registros = parsearPDFMRW(parsed.text);
          totalEnvios += registros.length;

          // 6. Marcar cada pedido como cobrado en la BD
          for (const { nEnvio } of registros) {
            if (!nEnvio) continue;
            // Buscar el pedido por tracking_number (orders no tiene user_id directo, va por shop)
            const order = await db.get(
              `SELECT o.id FROM orders o
               WHERE o.tracking_number = ?
                 AND (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = ?)`,
              [nEnvio, userId]
            );
            if (!order) continue;

            // Marcar como cobrado en reembolsos_estado con fecha del email
            await db.run(
              `INSERT INTO reembolsos_estado (user_id, order_id, estado, fecha_pago)
               VALUES (?, ?, 'cobrado', ?)
               ON CONFLICT (user_id, order_id) DO UPDATE SET estado = 'cobrado', fecha_pago = EXCLUDED.fecha_pago`,
              [userId, String(order.id), emailFecha]
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
      _debug: "Ver logs de Render para muestra del texto PDF",
    });

  } catch (e) {
    console.error("gmail sync-pdf error:", e);
    if (e.message === "GMAIL_RECONNECT") {
      return res.status(401).json({ error: "GMAIL_RECONNECT" });
    }
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
