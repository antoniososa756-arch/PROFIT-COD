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
const { procesarJustificanteCTT, marcarCobradosCTT } = require("./ctt-reembolsos");

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

// Remitente exacto de los justificantes de pago de CTT. Antes se buscaba
// cualquier "cttexpress.com" y entraban también los correos de los
// comerciales de CTT (respuestas, contactos...), que no traen albaranes.
const CTT_REMITENTE = "notificaciones@contact.cttexpress.com";
const CTT_JUSTIFICANTE_RE = /justificante de pago de reembolso|transferencia de reembolsos/i;

// Carpetas que NO se leen (enviados, papelera, spam, borradores). El resto sí:
// los justificantes no siempre están en la bandeja de entrada (reglas,
// archivados, carpetas propias...).
const CARPETAS_EXCLUIDAS_USE = ["\\Sent", "\\Trash", "\\Junk", "\\Drafts"];
const CARPETAS_EXCLUIDAS_RE = /sent|enviad|trash|papelera|spam|junk|draft|borrador|deleted|eliminad/i;

async function carpetasALeer(client) {
  const lista = await client.list();
  return lista
    .filter((m) => !(m.flags && (m.flags.has ? m.flags.has("\\Noselect") : false)))
    .filter((m) => !CARPETAS_EXCLUIDAS_USE.includes(m.specialUse))
    .filter((m) => m.specialUse === "\\Inbox" || m.path.toUpperCase() === "INBOX" || !CARPETAS_EXCLUIDAS_RE.test(m.path))
    .map((m) => m.path);
}

// Lee los correos de la agencia de esta cuenta (cfg.agencia) de los últimos
// `dias` días, en todas las carpetas útiles, y marca como cobrados los
// pedidos que aparezcan.
async function syncIMAPForUser(db, cfg, { dias = 40 } = {}) {
  const client = nuevoCliente(cfg);
  const toMadridDate = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
  const r = { correosCTT: 0, correosMRW: 0, albaranes: 0, procesados: 0, errores: [], detalle: [], carpetas: [] };
  const vistos = new Set(); // Message-ID: el mismo correo puede estar en varias carpetas
  await client.connect();
  try {
    const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const criterio = cfg.agencia === "ctt"
      ? { since, from: CTT_REMITENTE }
      : { since, or: [{ from: "mrw.es" }, { from: "grupomrw.com" }] };

    for (const carpeta of await carpetasALeer(client)) {
      let lock;
      try { lock = await client.getMailboxLock(carpeta); } catch (e) { continue; }
      try {
        const uids = (await client.search(criterio, { uid: true })) || [];
        if (uids.length) r.carpetas.push({ carpeta, correos: uids.length });
        for (const uid of uids) {
          try {
            const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
            if (!msg?.source) continue;
            const mail = await simpleParser(msg.source);
            if (mail.messageId) {
              if (vistos.has(mail.messageId)) continue;
              vistos.add(mail.messageId);
            }
            const from = (mail.from?.text || "").toLowerCase();
            const fecha = toMadridDate(mail.date || new Date());

            if (cfg.agencia === "ctt") {
              if (!from.includes(CTT_REMITENTE)) continue;
              const texto = `${mail.subject || ""}
${mail.text || ""}
${(mail.html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")}`;
              if (!CTT_JUSTIFICANTE_RE.test(texto)) continue; // solo justificantes de pago
              r.correosCTT++;
              const d = await procesarJustificanteCTT(db, cfg.user_id, texto, fecha);
              r.albaranes += d.albaranes.length;
              r.procesados += d.encontrados;
              // Detalle por correo para el diagnóstico de la pantalla
              r.detalle.push({ asunto: mail.subject || "", fecha, carpeta, ...d });
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
            r.errores.push({ carpeta, uid, error: e.message });
          }
        }
      } finally {
        lock.release();
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }
  await db.run(
    `UPDATE mail_imap_cuentas SET last_sync = now()::text, last_result = $1 WHERE user_id = $2 AND agencia = $3`,
    [JSON.stringify({ ...r, errores: r.errores.length, detalle: undefined }), cfg.user_id, cfg.agencia]
  ).catch(() => {});
  return r;
}

module.exports = { AGENCIAS, ensureImapTable, imapHostFor, probarConexionIMAP, syncIMAPForUser };
