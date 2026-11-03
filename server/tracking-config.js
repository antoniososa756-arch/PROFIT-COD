// Límite común a TODAS las agencias de envío (MRW, CTT y las que se añadan):
// las sincronizaciones automáticas y masivas solo consultan pedidos de los
// últimos TRACKING_MAX_DAYS días. Un envío más viejo sin entregar/devolver
// casi seguro que la agencia lo perdió -- se queda con su último estado y no
// se le vuelve a preguntar (cada consulta es ancho de banda de pago y ocupa
// sitio en la tanda de los envíos recientes). La consulta de un pedido suelto
// (historial desde el propio pedido) no lleva este límite.
// Toda agencia nueva debe filtrar su lista con trackingDesde().
const TRACKING_MAX_DAYS = 65;

// Fecha mínima (YYYY-MM-DD) para comparar con orders.created_at, que es TEXT
// ISO de Shopify -- comparar como texto evita que un valor raro rompa la
// consulta con un cast a timestamptz.
function trackingDesde() {
  return new Date(Date.now() - TRACKING_MAX_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

module.exports = { TRACKING_MAX_DAYS, trackingDesde };
