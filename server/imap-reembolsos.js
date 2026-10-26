// server/imap-reembolsos.js — Reembolsos COD cobrados, leídos de cualquier
// buzón por IMAP (Titan/HostGator, Gmail, Outlook, ...).
//
// Complementa a la integración de Gmail por OAuth (gmail.pdf.routes.js), que
// solo sirve para cuentas Google: aquí basta con correo + contraseña, así que
// funciona también con correos de empresa que solo se abren en Titan.
// En el mismo buzón se procesan las dos agencias:
//  - CTT: el justificante de pago va en el CUERPO del correo (albaranes de 22
//    dígitos) -- ver ctt-reembolsos.js.
//  - MRW: la liquidación va en un PDF adjunto (Nº envío 04700X999999), igual
//    que lee la integración de Gmail.
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const pdfParse = require("pdf-parse");
const { extraerAlbaranesCTT, marcarCobradosCTT } = require("./ctt-reembolsos");

async function ensureImapTable(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS mail_imap_config (
      user_id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 993,
      last_sync TEXT,
      last_result TEXT,
      created_at TEXT DEFAULT now()::text
    )`);
}

// Servidor IMAP según el dominio del correo. Los dominios propios (correo de
// empresa) se asume que están en Titan, que es lo que da HostGator; se puede
// indicar otro servidor a mano desde la pantalla.
function imapHostFor(email) {
  const dom = String(email || "").split("@")[1]?.toLowerCase() || "";
  if (["gmail.com", "googlemail.com"].includes(dom)) return "imap.gmail.com";
  if (["outlook.com", "hotmail.com", "hotmail.es", "live.com", "msn.com"].includes(dom)) return "outlook.office365.com";
  if (["yahoo.com", "yahoo.es"].includes(dom)) return "imap.mail.yahoo.com";
  if (["icloud.com", "me.com"].includes(dom)) return "imap.mail.me.com";
  return "imap.titan.email";
}

function nuevoCliente(cfg) {
  return new ImapFlow({
    host: cfg.host,
    port: cfg.port || 993,
    secure: true,
    auth: { user: cfg.email, pass: cfg.password },
    logger: false,
    socketTimeout: 60000,
  });
}

// Prueba de conexión al guardar: así no se guarda una contraseña mala en silencio.
async function probarConexionIMAP(cfg) {
  const client = nuevoCliente(cfg);
  await client.connect();
  await client.logout().catch(() => {});
}

const MRW_ENVIO_RE = /04700[A-Z]\d{6}/g;

// Lee los correos de CTT y MRW de los últimos `dias` días y marca como
// cobrados los pedidos que aparezcan.
async function syncIMAPForUser(db, cfg, { dias = 40 } = {}) {
  const client = nuevoCliente(cfg);
  const toMadridDate = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
  const r = { correosCTT: 0, correosMRW: 0, albaranes: 0, procesados: 0, errores: [] };
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
      const uids = await client.search({
        since,
        or: [{ from: "cttexpress.com" }, { from: "mrw.es" }, { from: "grupomrw.com" }],
      }, { uid: true });

      for (const uid of uids || []) {
        try {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg?.source) continue;
          const mail = await simpleParser(msg.source);
          const from = (mail.from?.text || "").toLowerCase();
          const fecha = toMadridDate(mail.date || new Date());

          if (from.includes("cttexpress.com")) {
            const texto = `${mail.text || ""}\n${(mail.html || "").replace(/<[^>]+>/g, " ")}`;
            if (!/reembolso/i.test(texto)) continue; // solo justificantes de pago
            r.correosCTT++;
            const albaranes = extraerAlbaranesCTT(texto);
            r.albaranes += albaranes.length;
            r.procesados += await marcarCobradosCTT(db, cfg.user_id, albaranes, fecha);
          } else {
            const pdfs = (mail.attachments || []).filter((a) =>
              a.contentType === "application/pdf" || String(a.filename || "").toLowerCase().endsWith(".pdf"));
            if (!pdfs.length) continue;
            r.correosMRW++;
            for (const a of pdfs) {
              const parsed = await pdfParse(a.content);
              const envios = [...new Set(parsed.text.match(MRW_ENVIO_RE) || [])];
              r.albaranes += envios.length;
              r.procesados += await marcarCobradosCTT(db, cfg.user_id, envios, fecha);
            }
          }
        } catch (e) {
          r.errores.push({ uid, error: e.message });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  await db.run(
    `UPDATE mail_imap_config SET last_sync = now()::text, last_result = $1 WHERE user_id = $2`,
    [JSON.stringify({ ...r, errores: r.errores.length }), cfg.user_id]
  ).catch(() => {});
  return r;
}

module.exports = { ensureImapTable, imapHostFor, probarConexionIMAP, syncIMAPForUser };
