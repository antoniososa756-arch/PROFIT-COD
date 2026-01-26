const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/**
 * Importa pedidos nuevos de Shopify y los guarda en DB
 */
async function importOrdersFromShopify(db, shop) {
  const { id: shopId, shop_domain, access_token } = shop;

  const res = await fetch(
    `https://${shop_domain}/admin/api/2026-01/orders.json?status=any&limit=250`,
    {
      headers: {
        "X-Shopify-Access-Token": access_token,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Shopify error: " + text);
  }

  const data = await res.json();
  const orders = data.orders || [];

  let imported = 0;

  for (const o of orders) {
    try {
      await db.run(
        `
        INSERT OR IGNORE INTO orders (
          shop_id,
          order_id,
          order_number,
          created_at,
          customer_name,
          total_price,
          currency,
          fulfillment_status,
          tracking_number,
          raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          shopId,
          o.id,
          o.name,
          o.created_at,
          o.customer
            ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
            : "Cliente",
          parseFloat(o.total_price || 0),
          o.currency,
          o.fulfillment_status || "pendiente",
          o.fulfillments?.[0]?.tracking_number || null,
          JSON.stringify(o),
        ]
      );

      imported++;
    } catch (e) {
      // IGNORAR duplicados
    }
  }

  await db.run(
    `UPDATE shops SET last_sync = datetime('now') WHERE id = ?`,
    [shopId]
  );

  return imported;
}

module.exports = { importOrdersFromShopify };
