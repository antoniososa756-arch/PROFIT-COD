const express = require("express");
const jwt = require("jsonwebtoken");
const sseManager = require("../sse");
const router = express.Router();

router.get("/", (req, res) => {
  const token = req.query.token;
  let userId;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    userId = payload.id;
    if (!userId) throw new Error("sin id");
  } catch (e) {
    console.warn("[SSE] Token inválido:", e.message);
    return res.status(401).end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // evita buffering en nginx/Render
  res.flushHeaders();

  // Mensaje inicial para confirmar conexión
  res.write(": connected\n\n");

  sseManager.add(userId, res);

  // Ping cada 25s para mantener viva la conexión
  const interval = setInterval(() => {
    try { res.write(": ping\n\n"); if (res.flush) res.flush(); } catch { clearInterval(interval); }
  }, 25000);

  req.on("close", () => {
    clearInterval(interval);
    sseManager.remove(userId, res);
  });
});

module.exports = router;
