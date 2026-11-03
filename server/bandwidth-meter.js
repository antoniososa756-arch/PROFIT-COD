// Medidor temporal de salida de datos por destino. Render factura por GB el
// tráfico que sale del servidor ("Service-Initiated" + "HTTP Responses") y su
// panel no dice a dónde va. Cada 5 min sale en los Logs como [Salida] con los
// MB enviados a cada host (Postgres, Shopify, MRW...) y a los navegadores.
// Cuenta lo que la app escribe en cada socket (en TLS, antes de cifrar), así
// que es una aproximación, pero basta para ver qué destino se lo come.
// Quitar (este archivo y su require en index.js) una vez diagnosticado.
const net = require("net");

const bytes = {};

function destino(sock) {
  if (sock.server) return "→ navegadores (respuestas HTTP)";
  const host = sock.servername || sock._host || sock.remoteAddress || "?";
  return `→ ${host}`;
}

const origWrite = net.Socket.prototype.write;
net.Socket.prototype.write = function (chunk, encoding, cb) {
  try {
    const n = typeof chunk === "string" ? Buffer.byteLength(chunk, typeof encoding === "string" ? encoding : "utf8") : (chunk?.length || 0);
    const k = destino(this);
    bytes[k] = (bytes[k] || 0) + n;
  } catch {}
  return origWrite.apply(this, arguments);
};

// Host de la base de datos (sin usuario ni contraseña): sin dominio = interna.
try {
  const host = new URL(process.env.DATABASE_URL || "").hostname;
  console.log(`[Salida] Base de datos: ${host} → ${host.includes(".") ? "URL EXTERNA (se factura)" : "URL interna (red privada)"}`);
} catch {}

setInterval(() => {
  const entries = Object.entries(bytes).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((acc, [, n]) => acc + n, 0);
  console.log(`[Salida] Últimos 5 min: ${(total / 1048576).toFixed(1)} MB enviados`);
  entries.slice(0, 15).forEach(([k, n]) => console.log(`[Salida]   ${(n / 1048576).toFixed(2).padStart(8)} MB  ${k}`));
  for (const k in bytes) delete bytes[k];
}, 5 * 60 * 1000);
module.exports = bytes;
