// Incidencias MRW por correo (Gestión Ecom > Incidencias MRW > Incidencias
// en curso). MRW avisa de cada anomalía con un correo:
//   Asunto: "G3 \ 04700F778094 \ ANOMALÍA \ Destinatario ausente o cerrado"
//   Cuerpo: Nº envío, Referencia del Cliente (#PEDIDO), destinatario,
//           "El envío no se ha podido entregar por: ...", fecha/hora...
// y a veces la franquicia escribe a mano en el mismo hilo
//   ("RE: [AN2] G3 \ 04700F776470 \ ANOMALÍA \ ...": "¿Devolvemos o destruimos?").
//
// Se lee por IMAP SOLO lo que envía el remitente configurado (p.ej.
// 04700@grupomrw.com), del buzón de Gmail donde se reciben y responden las
// incidencias, con contraseña de aplicación (no caduca ni requiere
// verificación de Google). Cada envío = una incidencia; cada correo de MRW
// sobre ese envío se guarda como mensaje de su hilo.
const crypto = require("crypto");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const db = require("./db");

// ── Contraseña cifrada en la base de datos (AES-256-GCM) ────────────────────
const CLAVE = crypto.createHash("sha256").update(String(process.env.JWT_SECRET || "profitcod") + ":incidencias").digest();
function cifrar(txt) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", CLAVE, iv);
  const enc = Buffer.concat([c.update(String(txt), "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}
function descifrar(s) {
  const [iv, tag, enc] = String(s || "").split(".");
  const d = crypto.createDecipheriv("aes-256-gcm", CLAVE, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
}

async function ensureTablas() {
  if (global.__incMrwTablas) return;
  await db.run(`
    CREATE TABLE IF NOT EXISTS incidencias_mrw_config (
      user_id INTEGER PRIMARY KEY,
      remitente TEXT NOT NULL,          -- quien envía las incidencias (MRW)
      email TEXT NOT NULL,              -- Gmail donde se reciben y responden
      password_enc TEXT NOT NULL,       -- contraseña de aplicación, cifrada
      ultimo_uid INTEGER DEFAULT 0,     -- último correo leído (IMAP UID)
      uid_validity TEXT,
      last_sync TEXT,
      last_result TEXT,
      created_at TEXT DEFAULT now()::text
    )`);
  await db.run(`
    CREATE TABLE IF NOT EXISTS incidencias_mrw (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      envio TEXT NOT NULL,              -- 04700F778094
      order_id INTEGER,                 -- orders.id (si se encontró)
      referencia TEXT,                  -- #LOJACOMFY32298 (del correo)
      tipo TEXT,                        -- "Destinatario ausente o cerrado"
      destinatario TEXT,
      telefono TEXT,
      direccion TEXT,
      fecha_anomalia TEXT,
      estado TEXT NOT NULL DEFAULT 'nueva',   -- nueva | respondida | resuelta
      mrw_escribio BOOLEAN DEFAULT false,     -- hay un correo escrito a mano sin atender
      ultimo_mensaje_at TEXT,
      created_at TEXT DEFAULT now()::text,
      UNIQUE (user_id, envio)
    )`);
  await db.run(`
    CREATE TABLE IF NOT EXISTS incidencias_mrw_mensajes (
      id SERIAL PRIMARY KEY,
      incidencia_id INTEGER NOT NULL REFERENCES incidencias_mrw(id) ON DELETE CASCADE,
      message_id TEXT,
      de TEXT,
      asunto TEXT,
      texto TEXT,
      fecha TEXT,
      manual BOOLEAN DEFAULT false,      -- escrito a mano por la franquicia
      saliente BOOLEAN DEFAULT false,    -- respuesta enviada desde ProfitCOD (fase 2)
      UNIQUE (incidencia_id, message_id)
    )`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_inc_mrw_user_estado ON incidencias_mrw (user_id, estado)`);
  await db.run(`ALTER TABLE incidencias_mrw_config ADD COLUMN IF NOT EXISTS version_lectura INTEGER DEFAULT 1`);
  global.__incMrwTablas = true;
}

function clienteImap(email, password) {
  return new ImapFlow({
    host: "imap.gmail.com", port: 993, secure: true,
    auth: { user: email, pass: password },
    logger: false, socketTimeout: 60000,
  });
}

async function probarConexion(email, password) {
  const c = clienteImap(email, password);
  await c.connect();
  await c.logout().catch(() => {});
}

// ── Lectura del correo de MRW ───────────────────────────────────────────────
const ENVIO_RE = /\b\d{5}[A-Z]\d{6}\b/;
// Valor tras "Etiqueta:". En el correo de MRW (HTML pasado a texto) a veces
// el valor cae en la línea siguiente: si la línea está vacía, se toma la
// siguiente que no sea otra etiqueta.
const campo = (texto, etiqueta) => {
  const m = texto.match(new RegExp(`${etiqueta}\\s*:?[ \\t]*([^\\n]*)(?:\\n+[ \\t]*([^\\n]*))?`, "i"));
  if (!m) return "";
  const v = m[1].trim();
  if (v) return v;
  const sig = (m[2] || "").trim();
  return sig && !/^[^:]{2,40}:/.test(sig) ? sig : "";
};
const textoDe = (parsed) => {
  const t = parsed.text || (parsed.html ? String(parsed.html).replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&") : "");
  return t.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n");
};

// Solo cuentan los correos de ANOMALÍA (el asunto lo dice, también en las
// respuestas a mano "RE: [AN2] G3 \ ... \ ANOMALÍA \ ..."). El mismo
// remitente envía otros avisos (entregas, etc.) que no son incidencias.
function analizarCorreo(parsed) {
  const asunto = parsed.subject || "";
  if (!/ANOMAL[ÍI]A/i.test(asunto)) return null;
  const texto = textoDe(parsed);
  const envio = (asunto.match(ENVIO_RE) || texto.match(ENVIO_RE) || [])[0] || null;
  if (!envio) return null;
  // Escrito a mano: respuesta/reenvío (RE:, RV:...) o sin la ficha automática
  const esRespuesta = /^\s*(re|rv|fw|fwd)\s*:/i.test(asunto);
  const automatico = !esRespuesta && /no se ha podido entregar por/i.test(texto) && /N[ºo°]\s*env[ií]o/i.test(texto);
  let tipo = (asunto.match(/ANOMAL[ÍI]A\s*\\\s*(.+)$/i) || [])[1] || campo(texto, "El env[ií]o no se ha podido entregar por");
  tipo = String(tipo || "").trim();
  // Solo lo nuevo del correo manual (sin el correo original citado debajo)
  const soloNuevo = texto.split(/\n\s*(De|From)\s*:\s*.+\n/i)[0].trim();
  return {
    envio,
    tipo,
    manual: !automatico,
    referencia: automatico ? (campo(texto, "Referencia del Cliente").match(/#?[A-Z0-9-]+/i) || [""])[0] : "",
    destinatario: automatico ? campo(texto, "Destinatario").replace(/\s*Tel[ée]fono:.*$/i, "") : "",
    telefono: automatico ? (campo(texto, "Tel[ée]fono").match(/\+?\d[\d\s]{7,}/) || [""])[0].replace(/\s/g, "") : "",
    direccion: automatico ? [campo(texto, "Direcci[óo]n"), campo(texto, "Poblaci[óo]n")].filter(Boolean).join(" · ") : "",
    fecha_anomalia: automatico ? [(texto.match(/Fecha de la Anomal[íi]a\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i) || [])[1], (texto.match(/Hora de la Anomal[íi]a\s*:?\s*(\d{1,2}:\d{2})/i) || [])[1]].filter(Boolean).join(" ") : "",
    asunto,
    texto: (automatico ? texto : soloNuevo).slice(0, 20000),
    de: parsed.from?.value?.[0]?.address || "",
    fecha: (parsed.date || new Date()).toISOString(),
    message_id: parsed.messageId || `${envio}-${(parsed.date || new Date()).getTime()}`,
  };
}

async function buscarPedido(userId, envio, referencia) {
  const tiendas = `(o.shop_id IN (SELECT id FROM shops WHERE user_id = $1)
                    OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))`;
  let r = await db.get(`SELECT o.id FROM orders o WHERE ${tiendas} AND btrim(o.tracking_number) = $2 ORDER BY o.id DESC LIMIT 1`, [userId, envio]);
  if (!r && referencia) {
    const ref = referencia.startsWith("#") ? referencia : `#${referencia}`;
    r = await db.get(`SELECT o.id FROM orders o WHERE ${tiendas} AND o.order_number = $2 ORDER BY o.id DESC LIMIT 1`, [userId, ref]);
  }
  return r?.id || null;
}

async function guardarCorreo(userId, a) {
  const orderId = await buscarPedido(userId, a.envio, a.referencia);
  // Una incidencia por envío. Un correo automático nuevo la reabre (nueva
  // anomalía); uno escrito a mano la marca para atenderla.
  const inc = await db.get(
    `INSERT INTO incidencias_mrw (user_id, envio, order_id, referencia, tipo, destinatario, telefono, direccion, fecha_anomalia, estado, mrw_escribio, ultimo_mensaje_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'nueva',$10,$11)
     ON CONFLICT (user_id, envio) DO UPDATE SET
       order_id = COALESCE(incidencias_mrw.order_id, EXCLUDED.order_id),
       referencia = COALESCE(NULLIF(EXCLUDED.referencia,''), incidencias_mrw.referencia),
       tipo = COALESCE(NULLIF(EXCLUDED.tipo,''), incidencias_mrw.tipo),
       destinatario = COALESCE(NULLIF(EXCLUDED.destinatario,''), incidencias_mrw.destinatario),
       telefono = COALESCE(NULLIF(EXCLUDED.telefono,''), incidencias_mrw.telefono),
       direccion = COALESCE(NULLIF(EXCLUDED.direccion,''), incidencias_mrw.direccion),
       fecha_anomalia = COALESCE(NULLIF(EXCLUDED.fecha_anomalia,''), incidencias_mrw.fecha_anomalia),
       estado = 'nueva',
       mrw_escribio = incidencias_mrw.mrw_escribio OR EXCLUDED.mrw_escribio,
       ultimo_mensaje_at = GREATEST(COALESCE(incidencias_mrw.ultimo_mensaje_at,''), EXCLUDED.ultimo_mensaje_at)
     RETURNING id`,
    [userId, a.envio, orderId, a.referencia, a.tipo, a.destinatario, a.telefono, a.direccion, a.fecha_anomalia, a.manual, a.fecha]
  );
  await db.run(
    `INSERT INTO incidencias_mrw_mensajes (incidencia_id, message_id, de, asunto, texto, fecha, manual)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (incidencia_id, message_id) DO NOTHING`,
    [inc.id, a.message_id, a.de, a.asunto, a.texto, a.fecha, a.manual]
  );
}

// Versión de las reglas de lectura. Al subirla, las incidencias se rehacen
// desde el correo (p.ej. la v1 tomaba también avisos que no eran anomalías).
const VERSION_LECTURA = 2;

// Lee los correos nuevos del remitente configurado. Primera vez: últimos 15
// días. Una sola lectura a la vez por usuario.
async function sincronizarUsuario(userId) {
  global.__incMrwEnCurso = global.__incMrwEnCurso || {};
  if (global.__incMrwEnCurso[userId]) return { ok: true, enCurso: true, leidos: 0, guardados: 0 };
  global.__incMrwEnCurso[userId] = true;
  try { return await _sincronizarUsuario(userId); }
  finally { delete global.__incMrwEnCurso[userId]; }
}

async function _sincronizarUsuario(userId) {
  await ensureTablas();
  let cfg = await db.get("SELECT * FROM incidencias_mrw_config WHERE user_id = $1", [userId]);
  if (!cfg) return { ok: false, error: "Sin configurar" };
  if (Number(cfg.version_lectura || 1) < VERSION_LECTURA) {
    await db.run("DELETE FROM incidencias_mrw WHERE user_id = $1", [userId]);
    await db.run("UPDATE incidencias_mrw_config SET ultimo_uid = 0, version_lectura = $1 WHERE user_id = $2", [VERSION_LECTURA, userId]);
    cfg = { ...cfg, ultimo_uid: 0, uid_validity: null };
  }
  const client = clienteImap(cfg.email, descifrar(cfg.password_enc));
  let leidos = 0, guardados = 0, maxUid = Number(cfg.ultimo_uid || 0);
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const validity = String(client.mailbox.uidValidity || "");
      if (cfg.uid_validity && cfg.uid_validity !== validity) maxUid = 0; // el buzón cambió: releer
      const criterio = { from: cfg.remitente };
      if (maxUid > 0) criterio.uid = `${maxUid + 1}:*`;
      else criterio.since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const uids = ((await client.search(criterio, { uid: true })) || []).filter(u => u > maxUid);
      // De 50 en 50 (una petición por tanda en vez de una por correo)
      for (let i = 0; i < uids.length; i += 50) {
        const tanda = uids.slice(i, i + 50);
        for await (const msg of client.fetch(tanda.join(","), { uid: true, source: true }, { uid: true })) {
          leidos++;
          if (msg?.source) {
            const a = analizarCorreo(await simpleParser(msg.source));
            if (a) { await guardarCorreo(userId, a); guardados++; }
          }
          if (msg.uid > maxUid) maxUid = msg.uid;
        }
        await db.run("UPDATE incidencias_mrw_config SET ultimo_uid = $1, uid_validity = $2 WHERE user_id = $3", [maxUid, validity, userId]);
      }
      if (!uids.length) await db.run("UPDATE incidencias_mrw_config SET uid_validity = $1 WHERE user_id = $2", [validity, userId]);
    } finally { lock.release(); }
    await client.logout().catch(() => {});
    const res = { ok: true, leidos, guardados };
    await db.run("UPDATE incidencias_mrw_config SET last_sync = now()::text, last_result = $1 WHERE user_id = $2", [JSON.stringify(res), userId]);
    return res;
  } catch (e) {
    try { await client.logout(); } catch (_) {}
    const res = { ok: false, error: /auth|credentials|login/i.test(e.message) ? "Gmail rechazó el correo o la contraseña de aplicación" : e.message };
    await db.run("UPDATE incidencias_mrw_config SET last_sync = now()::text, last_result = $1 WHERE user_id = $2", [JSON.stringify(res), userId]).catch(() => {});
    return res;
  }
}

// Cron: cada 5 min de 8:00 a 20:00 (España), todas las cuentas configuradas.
// Además cierra solas las incidencias cuyo pedido ya se entregó/devolvió.
async function sincronizarTodas() {
  const h = Number(new Date().toLocaleString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }));
  if (h >= 20 || h < 8) return;
  if (global.__incMrwRunning) return;
  global.__incMrwRunning = true;
  try {
    await ensureTablas();
    const cuentas = await db.all("SELECT user_id FROM incidencias_mrw_config");
    for (const c of cuentas) {
      const r = await sincronizarUsuario(c.user_id);
      if (r.guardados) console.log(`📮 [Incidencias MRW] user ${c.user_id}: ${r.guardados} correos nuevos`);
      if (!r.ok) console.warn(`[Incidencias MRW] user ${c.user_id}:`, r.error);
    }
    await db.run(`
      UPDATE incidencias_mrw i SET estado = 'resuelta'
      FROM orders o
      WHERE i.order_id = o.id AND i.estado <> 'resuelta'
        AND o.fulfillment_status IN ('entregado','devuelto','destruido','cancelado')`);
  } catch (e) {
    console.error("[Incidencias MRW] cron:", e.message);
  } finally { global.__incMrwRunning = false; }
}

module.exports = { ensureTablas, cifrar, descifrar, probarConexion, sincronizarUsuario, sincronizarTodas, analizarCorreo };
