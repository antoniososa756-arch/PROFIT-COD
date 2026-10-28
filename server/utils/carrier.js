// Registro único de agencias de envío. Para añadir una nueva agencia basta con
// meterla aquí (id = valor de orders.carrier, tabla = donde se guardan sus
// credenciales): Reembolsos, Métricas, Rentabilidad y el widget del menú la
// muestran sola en cuanto la cuenta tenga credenciales guardadas.
const AGENCIAS = [
  { id: "mrw", nombre: "MRW", nombreLargo: "MRW", tabla: "mrw_credentials" },
  { id: "ctt", nombre: "CTT", nombreLargo: "CTT Express", tabla: "ctt_credentials" },
];
const AGENCIA_IDS = AGENCIAS.map((a) => a.id);

// Agencias del registro con sus credenciales guardadas para este usuario
// (el padre, si es una cuenta de apoyo -- auth ya deja req.user.id así).
async function agenciasConectadas(db, userId) {
  const out = [];
  for (const a of AGENCIAS) {
    let conectada = false;
    try {
      conectada = !!(await db.get(`SELECT 1 FROM ${a.tabla} WHERE user_id = $1 LIMIT 1`, [userId]));
    } catch (e) {} // tabla aún sin crear = no conectada
    out.push({ id: a.id, nombre: a.nombre, nombreLargo: a.nombreLargo, conectada });
  }
  return out;
}

// Filtro SQL por agencia de envío (?carrier=<id>), compartido entre
// Métricas, Pedidos y Reembolsos para que el número de una tarjeta y la
// lista que abre al hacer clic sean exactamente los mismos pedidos.
// Usa SOLO orders.carrier (nunca buscar dentro de raw_json: es enorme y
// colgaba Métricas). La rellena Shopify (trigger en db.js) o la primera
// agencia que encuentra el envío. Los pedidos YA CERRADOS con seguimiento y
// sin agencia son históricos de MRW (de antes de existir carrier). Un pedido
// abierto sin agencia aún no cuenta en ninguna hasta que se detecta (máx.
// 5 min) -- así nunca sale en la equivocada. Solo ids del registro (el valor
// va dentro del SQL).
function carrierCond(carrier) {
  if (!AGENCIA_IDS.includes(carrier)) return "";
  if (carrier === "mrw") return `AND (o.carrier = 'mrw' OR (o.carrier IS NULL AND COALESCE(o.tracking_number,'') != '' AND o.fulfillment_status IN ('entregado','devuelto','destruido','cancelado')))`;
  return `AND o.carrier = '${carrier}'`;
}

module.exports = { AGENCIAS, AGENCIA_IDS, agenciasConectadas, carrierCond };
