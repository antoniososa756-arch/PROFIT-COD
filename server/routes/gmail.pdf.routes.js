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
  const verbose = req.query.debug === "1";

  try {
    const query = encodeURIComponent(
      '{from:mrw.es from:grupomrw.com} has:attachment filename:pdf after:2025/1/1'
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
    const debugEmails = [];

    for (const msg of messages) {
      const debugEmail = { id: msg.id, asunto: "?", fecha: "?", pdfs: [] };
      try {
        const msgRes = await gmailFetch(
          db, userId,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`
        );
        const msgData = await msgRes.json();

        const hdrs = msgData.payload?.headers || [];
        debugEmail.asunto = hdrs.find(h => h.name === "Subject")?.value || "?";
        debugEmail.de     = hdrs.find(h => h.name === "From")?.value || "?";
        debugEmail.fecha  = hdrs.find(h => h.name === "Date")?.value || "?";

        const toMadridDate = d => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
        const emailFecha = msgData.internalDate
          ? toMadridDate(new Date(parseInt(msgData.internalDate)))
          : toMadridDate(new Date());

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
          p.mimeType === "application/octet-stream" ||
          p.filename?.toLowerCase().endsWith(".pdf")
        );

        debugEmail.adjuntosTotales = todasPartes.length;
        debugEmail.adjuntosPDF = pdfs.length;

        for (const parte of pdfs) {
          const attachId = parte.body?.attachmentId;
          const debugPDF = { nombre: parte.filename || "?", trackings: [], coincidencias: 0 };
          if (!attachId) { debugPDF.error = "sin attachmentId"; debugEmail.pdfs.push(debugPDF); continue; }
          totalPDFs++;

          const attRes = await gmailFetch(
            db, userId,
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${attachId}`
          );
          const attData = await attRes.json();
          const pdfBuffer = Buffer.from(attData.data, "base64url");

          const parsed = await pdfParse(pdfBuffer);
          const registros = parsearPDFMRW(parsed.text);
          totalEnvios += registros.length;

          debugPDF.trackings = registros.map(r => r.nEnvio);
          if (verbose) debugPDF.textoPDF = parsed.text.slice(0, 1200);

          for (const { nEnvio } of registros) {
            if (!nEnvio) continue;
            const order = await db.get(
              `SELECT o.id FROM orders o
               WHERE o.tracking_number = ?
                 AND (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = ?)`,
              [nEnvio, userId]
            );
            if (!order) continue;

            await db.run(
              `INSERT INTO reembolsos_estado (user_id, order_id, estado, fecha_pago)
               VALUES (?, ?, 'cobrado', ?)
               ON CONFLICT (user_id, order_id) DO UPDATE SET estado = 'cobrado', fecha_pago = EXCLUDED.fecha_pago`,
              [userId, String(order.id), emailFecha]
            );
            totalMarcados++;
            debugPDF.coincidencias++;
          }
          debugEmail.pdfs.push(debugPDF);
        }
      } catch (e) {
        debugEmail.error = e.message;
        errores.push({ msgId: msg.id, error: e.message });
      }
      debugEmails.push(debugEmail);
    }

    res.json({
      ok: true,
      emailsLeidos: messages.length,
      pdfsProcesados: totalPDFs,
      enviosEncontrados: totalEnvios,
      procesados: totalMarcados,
      errores,
      debug: debugEmails,
    });

  } catch (e) {
    console.error("gmail sync-pdf error:", e);
    if (e.message === "GMAIL_RECONNECT") {
      return res.status(401).json({ error: "GMAIL_RECONNECT" });
    }
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/gmail/debug-mrw — diagnóstico: qué correos de reembolsos hay ───
router.get("/debug-mrw", async (req, res) => {
  const userId = req.user.id;
  const db = req.db;
  try {
    // Buscar TODOS los emails de MRW con PDF adjunto (sin filtro de asunto)
    const query = encodeURIComponent(
      '{from:mrw.es from:grupomrw.com} has:attachment filename:pdf after:2025/1/1'
    );
    const listRes = await gmailFetch(
      db, userId,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`
    );
    const listData = await listRes.json();
    const messages = listData.messages || [];

    const senders = [];
    for (const msg of messages.slice(0, 8)) {
      const msgRes = await gmailFetch(
        db, userId,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
      );
      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers || [];
      const from    = headers.find(h => h.name === "From")?.value || "?";
      const subject = headers.find(h => h.name === "Subject")?.value || "?";
      const date    = headers.find(h => h.name === "Date")?.value || "?";
      senders.push({ from, subject, date });
    }
    res.json({ total: messages.length, muestra: senders });
  } catch (e) {
    if (e.message === "GMAIL_RECONNECT") return res.status(401).json({ error: "GMAIL_RECONNECT" });
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
