// server/imap-reembolsos.js — Reembolsos COD cobrados, leídos de cualquier
// buzón por IMAP (Titan/HostGator, Gmail, Outlook, ...).
//
// Complementa a la integración de Gmail por OAuth (gmail.pdf.routes.js), que
// solo sirve para cuentas Google: aquí basta con correo + contraseña, así que
// funciona también con correos de empresa que solo se abren en Titan.
// Cada usuario puede tener un correo por agencia (mail_imap_cuentas.agencia),
// y cada correo solo lee los de su agencia:
//  - CTT: el justificante de pago va en el CUERPO del correo (albaranes de 22
//    dígitos) -- ver ctt-reembolsos.js.
//  - MRW: la liquidación va en un PDF adjunto (Nº envío 04700X999999), igual
//    que lee la integración de Gmail.
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const pdfParse = require("pdf-parse");
const { extraerAlbaranesCTT, marcarCobradosCTT } = require("./ctt-reembolsos");

const AGENCIAS = ["mrw", "ctt"];

async function ensureImapTable(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS mail_imap_cuentas (
      user_id INTEGER NOT NULL,
      agencia TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 993,
      last_sync TEXT,
      last_result TEXT,
      created_at TEXT DEFAULT now()::text,
      PRIMARY KEY (user_id, agencia)
    )`);
  // Primera versión (un solo correo por usuario, sin agencia): se conectaba
  // desde la tarjeta de "correo de empresa" pensada para CTT -> pasa a CTT.
  try {
    await db.run(`
      INSERT INTO mail_imap_cuentas (user_id, agencia, email, password, host, port, last_sync, last_result)
      SELECT user_id, 'ctt', email, password, host, port, last_sync, last_result FROM mail_imap_config
      ON CONFLICT DO NOTHING`);
    await db.run(`DROP TABLE mail_imap_config`);
  } catch (e) {} // ya migrada (la tabla vieja no existe)
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

// Lee los correos de la agencia de esta cuenta (cfg.agencia) de los últimos
// `dias` días y marca como cobrados los pedidos que aparezcan.
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
        ...(cfg.agencia === "ctt"
          ? { from: "cttexpress.com" }
          : { or: [{ from: "mrw.es" }, { from: "grupomrw.com" }] }),
      }, { uid: true });

      for (const uid of uids || []) {
        try {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg?.source) continue;
          const mail = await simpleParser(msg.source);
          const from = (mail.from?.text || "").toLowerCase();
          const fecha = toMadridDate(mail.date || new Date());

          if (cfg.agencia === "ctt" && from.includes("cttexpress.com")) {
            const texto = `${mail.text || ""}\n${(mail.html || "").replace(/<[^>]+>/g, " ")}`;
            if (!/reembolso/i.test(texto)) continue; // solo justificantes de pago
            r.correosCTT++;
            const albaranes = extraerAlbaranesCTT(texto);
            r.albaranes += albaranes.length;
            r.procesados += await marcarCobradosCTT(db, cfg.user_id, albaranes, fecha);
          } else if (cfg.agencia === "mrw") {
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
    `UPDATE mail_imap_cuentas SET last_sync = now()::text, last_result = $1 WHERE user_id = $2 AND agencia = $3`,
    [JSON.stringify({ ...r, errores: r.errores.length }), cfg.user_id, cfg.agencia]
  ).catch(() => {});
  return r;
}

module.exports = { AGENCIAS, ensureImapTable, imapHostFor, probarConexionIMAP, syncIMAPForUser };
