// Filtro SQL por agencia de envío (?carrier=ctt|mrw), compartido entre
// Métricas y el listado de Pedidos para que el número de una tarjeta y la
// lista que abre al hacer clic sean exactamente los mismos pedidos.
// Usa SOLO orders.carrier (nunca buscar dentro de raw_json: es enorme y
// colgaba Métricas). La rellena Shopify (trigger en db.js) o la primera
// agencia que encuentra el envío. Los pedidos YA CERRADOS con seguimiento y
// sin agencia son históricos de MRW (de antes de existir carrier). Un pedido
// abierto sin agencia aún no cuenta en ninguna de las dos hasta que se
// detecta (máx. 5 min) -- así nunca sale en la equivocada.
function carrierCond(carrier) {
  if (carrier === "ctt") return `AND o.carrier = 'ctt'`;
  if (carrier === "mrw") return `AND (o.carrier = 'mrw' OR (o.carrier IS NULL AND COALESCE(o.tracking_number,'') != '' AND o.fulfillment_status IN ('entregado','devuelto','destruido','cancelado')))`;
  return "";
}

module.exports = { carrierCond };
