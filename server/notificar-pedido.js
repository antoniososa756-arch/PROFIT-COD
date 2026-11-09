// Aviso de "pedido nuevo" (cuadro de color + sonido + notificación de
// escritorio en el navegador, vía SSE). Lo llama quien guarde el pedido POR
// PRIMERA VEZ: el webhook orders/create o el sync de Shopify de cada minuto.
// Antes solo avisaba el webhook, y si el sync llegaba antes el webhook lo veía
// como repetido y el pedido entraba sin notificación.
const db = require("./db");
const sseManager = require("./sse");

async function notificarPedidoNuevo(shop, order) {
  let dailyCount = 1;
  try {
    const countRow = await db.get(
      `SELECT COUNT(*) AS cnt FROM orders
       WHERE shop_id = $1
       AND (created_at::timestamptz AT TIME ZONE 'Europe/Madrid')::date
         = (NOW() AT TIME ZONE 'Europe/Madrid')::date`,
      [shop.id]
    );
    dailyCount = parseInt(countRow?.cnt || 1, 10);
  } catch (e) {
    console.warn("[Pedido nuevo] Error contando pedidos del día:", e.message);
  }
  const color = shop.notification_color || "#3b82f6";
  const shopName = shop.shop_name || shop.shop_domain;
  sseManager.emitToUser(shop.user_id, {
    type: "new_order", color, shopName, dailyCount, orderNumber: order.name,
  });
  return dailyCount;
}

module.exports = { notificarPedidoNuevo };
