const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");

// userId -> Set<WebSocket>
const connections = new Map();

function setup(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Ping cada 25s para mantener la conexión viva a través del proxy de Render
  const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 25000);

  wss.on("close", () => clearInterval(pingInterval));

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");
    let userId;

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      userId = payload.id || payload.userId;
    } catch (e) {
      console.warn("[WS] Token inválido:", e.message);
      ws.close(4001, "Unauthorized");
      return;
    }

    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId).add(ws);
    console.log(`[WS] Usuario ${userId} conectado. Total conexiones: ${wss.clients.size}`);

    ws.on("close", () => {
      const set = connections.get(userId);
      if (set) { set.delete(ws); if (set.size === 0) connections.delete(userId); }
    });

    ws.on("error", () => ws.terminate());
  });
}

function emitToUser(userId, payload) {
  const set = connections.get(userId);
  if (!set || set.size === 0) {
    console.log(`[WS] emitToUser(${userId}): sin conexiones activas`);
    return;
  }
  const msg = JSON.stringify(payload);
  let sent = 0;
  for (const ws of set) {
    if (ws.readyState === 1) { ws.send(msg); sent++; }
  }
  console.log(`[WS] emitToUser(${userId}): enviado a ${sent} socket(s)`);
}

module.exports = { setup, emitToUser };
