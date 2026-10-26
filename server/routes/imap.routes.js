// server/routes/imap.routes.js — Correo por IMAP para reembolsos (Titan,
// Gmail, Outlook...), uno por agencia (?agencia=mrw|ctt). Ver
// server/imap-reembolsos.js.
const express = require("express");
const { AGENCIAS, ensureImapTable, imapHostFor, probarConexionIMAP, syncIMAPForUser } = require("../imap-reembolsos");
const router = express.Router();

router.use(async (req, res, next) => {
  try { await ensureImapTable(req.db); } catch (e) {}
  const agencia = String(req.query.agencia || req.body?.agencia || "").toLowerCase();
  if (!AGENCIAS.includes(agencia)) return res.status(400).json({ error: "Agencia no válida (mrw o ctt)" });
  req.agencia = agencia;
  next();
});

// GET /api/imap/config?agencia= — nunca devuelve la contraseña
router.get("/config", async (req, res) => {
  try {
    const row = await req.db.get(
      "SELECT email, host, port, last_sync, last_result FROM mail_imap_cuentas WHERE user_id = $1 AND agencia = $2",
      [req.user.id, req.agencia]
    );
    if (!row) return res.json({ connected: false });
    let last = null;
    try { last = row.last_result ? JSON.parse(row.last_result) : null; } catch (e) {}
    res.json({ connected: true, email: row.email, host: row.host, port: row.port, last_sync: row.last_sync, last_result: last });
  } catch (e) {
    res.json({ connected: false });
  }
});

// POST /api/imap/config { agencia, email, password, host? } — prueba la conexión antes de guardar
router.post("/config", async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");
  const host = String(req.body?.host || "").trim() || imapHostFor(email);
  const port = parseInt(req.body?.port, 10) || 993;
  if (!email || !password) return res.status(400).json({ error: "Correo y contraseña obligatorios" });
  try {
    await probarConexionIMAP({ email, password, host, port });
  } catch (e) {
    const detalle = e.responseText || e.message || "";
    let hint = "";
    if (host === "imap.gmail.com") {
      hint = " En Gmail tienes que usar una \"contraseña de aplicación\" (no tu contraseña normal).";
    } else if (/auth not allowed/i.test(detalle)) {
      // Titan: el buzón tiene desactivado el acceso desde apps externas (IMAP).
      hint = " Tu correo tiene bloqueado el acceso desde aplicaciones externas (IMAP): actívalo en la configuración de Titan y vuelve a intentarlo.";
    } else if (/authenticat|invalid credentials|login failed/i.test(detalle)) {
      hint = " Revisa el correo y la contraseña.";
    }
    return res.status(400).json({ error: `No se pudo entrar al correo (${host}): ${detalle}.${hint}` });
  }
  try {
    await req.db.run(
      `INSERT INTO mail_imap_cuentas (user_id, agencia, email, password, host, port)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, agencia) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password, host = EXCLUDED.host, port = EXCLUDED.port`,
      [req.user.id, req.agencia, email, password, host, port]
    );
    res.json({ ok: true, host });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/config", async (req, res) => {
  try {
    await req.db.run("DELETE FROM mail_imap_cuentas WHERE user_id = $1 AND agencia = $2", [req.user.id, req.agencia]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/imap/sync?agencia= — importar ahora (mira el último año, el cron solo 40 días)
router.post("/sync", async (req, res) => {
  try {
    const cfg = await req.db.get("SELECT * FROM mail_imap_cuentas WHERE user_id = $1 AND agencia = $2", [req.user.id, req.agencia]);
    if (!cfg) return res.status(400).json({ error: "No hay correo conectado" });
    res.json({ ok: true, ...(await syncIMAPForUser(req.db, cfg, { dias: 365 })) });
  } catch (e) {
    res.status(500).json({ error: e.responseText || e.message });
  }
});

module.exports = router;
