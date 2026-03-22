const express = require("express");
const db = require("../db");
const router = express.Router();

// Middleware de auth opcional (no falla si no hay token)
function optAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) { req.user = null; return next(); }
  try {
    const jwt = require("jsonwebtoken");
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch { req.user = null; }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "NO_AUTH" });
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Solo admin" });
  next();
}

// ── GET /api/chat/messages ──────────────────────────────────────
// Cliente: sus mensajes. Admin: todos o filtrado por ?user_id=X o ?guest_id=X
router.get("/messages", optAuth, requireAuth, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const userId   = req.query.user_id  ? parseInt(req.query.user_id)  : null;
      const guestId  = req.query.guest_id || null;
      let rows;
      if (userId) {
        rows = await db.all(
          "SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC",
          [userId]
        );
        // Marcar como leídos por admin
        await db.run("UPDATE chat_messages SET read_by_admin = 1 WHERE user_id = $1 AND read_by_admin = 0", [userId]);
      } else if (guestId) {
        rows = await db.all(
          "SELECT * FROM chat_messages WHERE guest_id = $1 ORDER BY created_at ASC",
          [guestId]
        );
        await db.run("UPDATE chat_messages SET read_by_admin = 1 WHERE guest_id = $1 AND read_by_admin = 0", [guestId]);
      } else {
        rows = await db.all("SELECT * FROM chat_messages ORDER BY created_at ASC");
      }
      return res.json({ messages: rows });
    } else {
      const rows = await db.all(
        "SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC",
        [req.user.id]
      );
      await db.run("UPDATE chat_messages SET read_by_client = 1 WHERE user_id = $1 AND read_by_client = 0", [req.user.id]);
      return res.json({ messages: rows });
    }
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/chat/messages — cliente autenticado envía mensaje ──
router.post("/messages", optAuth, requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Mensaje vacío" });
  try {
    const sender = req.user.role === "admin" ? "admin" : "client";
    const userId = req.user.role === "admin"
      ? (req.body.to_user_id || null)  // admin responde a un usuario
      : req.user.id;

    await db.run(
      `INSERT INTO chat_messages (user_id, sender, content, created_at, read_by_admin, read_by_client)
       VALUES ($1, $2, $3, now()::text, $4, $5)`,
      [userId, sender, content.trim(),
       sender === "admin" ? 1 : 0,   // admin ya leyó su propio msg
       sender === "client" ? 1 : 0]  // cliente ya leyó su propio msg
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/chat/guest — mensaje anónimo desde login ──────────
router.post("/guest", async (req, res) => {
  const { content, guest_name, guest_email, guest_id } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Mensaje vacío" });
  if (!guest_id?.trim()) return res.status(400).json({ error: "Falta guest_id" });
  try {
    await db.run(
      `INSERT INTO chat_messages (guest_id, guest_name, guest_email, sender, content, created_at, read_by_admin, read_by_client)
       VALUES ($1, $2, $3, 'guest', $4, now()::text, 0, 1)`,
      [guest_id.trim(), (guest_name||"Visitante").trim(), (guest_email||"").trim(), content.trim()]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/chat/guest/:guestId — mensajes anónimos (respuestas del admin) ──
router.get("/guest/:guestId", async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT * FROM chat_messages WHERE guest_id = $1 ORDER BY created_at ASC",
      [req.params.guestId]
    );
    await db.run("UPDATE chat_messages SET read_by_client = 1 WHERE guest_id = $1 AND read_by_client = 0", [req.params.guestId]);
    res.json({ messages: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/chat/conversations — admin: lista de conversaciones ──
router.get("/conversations", optAuth, requireAuth, requireAdmin, async (req, res) => {
  try {
    // Conversaciones de usuarios registrados
    const users = await db.query(`
      SELECT
        u.id         AS user_id,
        u.email,
        u.display_name,
        SUM(CASE WHEN m.read_by_admin = 0 AND m.sender != 'admin' THEN 1 ELSE 0 END) AS unread,
        MAX(m.created_at) AS last_message,
        (SELECT cm.content FROM chat_messages cm
         WHERE cm.user_id = u.id ORDER BY cm.created_at DESC LIMIT 1) AS last_content
      FROM chat_messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.user_id IS NOT NULL
      GROUP BY u.id, u.email, u.display_name
      ORDER BY last_message DESC
    `).then(r => r.rows);

    // Conversaciones anónimas
    const guests = await db.query(`
      SELECT
        guest_id,
        MAX(guest_name)  AS guest_name,
        MAX(guest_email) AS guest_email,
        SUM(CASE WHEN read_by_admin = 0 AND sender = 'guest' THEN 1 ELSE 0 END) AS unread,
        MAX(created_at)  AS last_message,
        (SELECT c2.content FROM chat_messages c2
         WHERE c2.guest_id = m.guest_id ORDER BY c2.created_at DESC LIMIT 1) AS last_content
      FROM chat_messages m
      WHERE guest_id IS NOT NULL
      GROUP BY guest_id
      ORDER BY last_message DESC
    `).then(r => r.rows);

    res.json({ users, guests });
  } catch(e) {
    console.error("[chat/conversations] Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/chat/unread — badge de mensajes no leídos ──────────
router.get("/unread", optAuth, requireAuth, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const row = await db.get(
        "SELECT COUNT(*) as cnt FROM chat_messages WHERE read_by_admin = 0 AND sender != 'admin'"
      );
      return res.json({ count: parseInt(row?.cnt || 0) });
    } else {
      const row = await db.get(
        "SELECT COUNT(*) as cnt FROM chat_messages WHERE user_id = $1 AND read_by_client = 0 AND sender = 'admin'",
        [req.user.id]
      );
      return res.json({ count: parseInt(row?.cnt || 0) });
    }
  } catch(e) { res.json({ count: 0 }); }
});

module.exports = router;
