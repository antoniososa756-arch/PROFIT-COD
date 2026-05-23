// userId -> Set<res>
const connections = new Map();

function add(userId, res) {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId).add(res);
  console.log(`[SSE] Usuario ${userId} conectado. Total: ${connections.get(userId).size}`);
}

function remove(userId, res) {
  const set = connections.get(userId);
  if (set) { set.delete(res); if (set.size === 0) connections.delete(userId); }
  console.log(`[SSE] Usuario ${userId} desconectado`);
}

function emitToUser(userId, data) {
  const set = connections.get(userId);
  if (!set || set.size === 0) {
    console.log(`[SSE] emitToUser(${userId}): sin conexiones activas`);
    return;
  }
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  let sent = 0;
  for (const res of set) {
    try { res.write(msg); if (res.flush) res.flush(); sent++; } catch {}
  }
  console.log(`[SSE] emitToUser(${userId}): enviado a ${sent} conexión(es)`);
}

module.exports = { add, remove, emitToUser };
