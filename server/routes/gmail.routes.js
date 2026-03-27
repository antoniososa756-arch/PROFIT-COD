const express = require("express");
const router  = express.Router();
const jwt     = require("jsonwebtoken");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const CLIENT_ID     = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI  = "https://profit-cod.onrender.com/api/gmail/callback";
const JWT_SECRET    = process.env.JWT_SECRET || "secret";

// Crear tabla si no existe
async function initTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS gmail_config (
      user_id     INTEGER PRIMARY KEY,
      email       TEXT,
      access_token  TEXT,
      refresh_token TEXT,
      connected   INTEGER DEFAULT 0
    )
  `);
}

// ─── GET /api/gmail/config ───────────────────────────────────────────────────
// Devuelve estado de conexión del usuario autenticado
router.get("/config", async (req, res) => {
  try {
    await initTable(req.db);
    const row = await req.db.get(
      "SELECT email, connected FROM gmail_config WHERE user_id = ?",
      [req.user.id]
    );
    res.json({ connected: !!(row?.connected), email: row?.email || "" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/gmail/config ──────────────────────────────────────────────────
// Guarda el email del usuario (antes de iniciar OAuth)
router.post("/config", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });
  try {
    await initTable(req.db);
    await req.db.run(
      `INSERT INTO gmail_config (user_id, email, connected)
       VALUES (?, ?, 0)
       ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email`,
      [req.user.id, email]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/gmail/config ────────────────────────────────────────────────
// Desconecta Gmail del usuario
router.delete("/config", async (req, res) => {
  try {
    await initTable(req.db);
    await req.db.run(
      "UPDATE gmail_config SET access_token=NULL, refresh_token=NULL, connected=0 WHERE user_id=?",
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/gmail/auth ─────────────────────────────────────────────────────
// Inicia el flujo OAuth — redirige a Google
// Se llama con ?token=JWT para identificar al usuario en el callback
router.get("/auth", (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send("Token requerido");

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/gmail.readonly",
    access_type:   "offline",
    prompt:        "consent",
    state:         token,   // guardamos el JWT del usuario como state
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// ─── GET /api/gmail/callback ──────────────────────────────────────────────────
// Google redirige aquí tras autorizar — SIN middleware auth (es redirect de Google)
router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error || !code) {
    return res.redirect("/#integraciones?gmail=error");
  }

  // Verificar el JWT del state para obtener el user_id
  let userId;
  try {
    const decoded = jwt.verify(state, JWT_SECRET);
    userId = decoded.id || decoded.userId;
  } catch {
    return res.redirect("/#integraciones?gmail=error");
  }

  // Intercambiar code por tokens
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      console.error("Gmail OAuth error:", tokens);
      return res.redirect("/#integraciones?gmail=error");
    }

    // Obtener email del usuario de Google
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    const email = profile.email || "";

    // Guardar tokens en DB
    const db = req.db;
    await initTable(db);
    await db.run(
      `INSERT INTO gmail_config (user_id, email, access_token, refresh_token, connected)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT (user_id) DO UPDATE SET
         email         = EXCLUDED.email,
         access_token  = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         connected     = 1`,
      [userId, email, tokens.access_token, tokens.refresh_token || ""]
    );

    // Redirigir al frontend con éxito
    res.redirect("/#integraciones?gmail=ok");
  } catch (e) {
    console.error("Gmail callback error:", e);
    res.redirect("/#integraciones?gmail=error");
  }
});

module.exports = router;
