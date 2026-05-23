const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");

// userId -> Set<WebSocket>
const connections = new Map();

function setup(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");
    let userId;

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      userId = payload.id || payload.userId;
    } catch {
      ws.close(4001, "Unauthorized");
      return;
    }

    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId).add(ws);

    ws.on("close", () => {
      const set = connections.get(userId);
      if (set) { set.delete(ws); if (set.size === 0) connections.delete(userId); }
    });

    ws.on("error", () => ws.terminate());
  });
}

function emitToUser(userId, payload) {
  const set = connections.get(userId);
  if (!set) return;
  const msg = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

module.exports = { setup, emitToUser };
