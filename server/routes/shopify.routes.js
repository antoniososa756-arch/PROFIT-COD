router.post("/sync-orders", auth, async (req, res) => {
  const userId = req.user.id;
  console.log("🔄 SYNC START user:", userId);
  try {
    const shops = await db.all("SELECT id, shop_domain, access_token FROM shops WHERE user_id = ? AND status = 'active'", [userId]);
    console.log("🏪 SHOPS:", shops.length, shops.map(s => s.shop_domain));
    if (!shops.length) return res.json({ ok: true, synced: 0 });

    let total = 0;
    for (const shop of shops) {
      try {
        console.log("📦 Fetching orders for:", shop.shop_domain);
        const r = await fetch(`https://${shop.shop_domain}/admin/api/2024-10/orders.json?status=any&limit=250`, {
          headers: { "X-Shopify-Access-Token": shop.access_token },
        });
        console.log("📦 Shopify response status:", r.status);
        if (!r.ok) {
          const txt = await r.text();
          console.error("❌ Shopify error:", txt);
          continue;
        }
        const { orders } = await r.json();
        console.log("📦 Orders received:", orders.length);
        for (const o of orders) {
          const customerName = o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : "Desconocido";
          await db.run(
            `INSERT INTO orders (shop_id, order_id, order_number, customer_name, fulfillment_status, tracking_number, total_price, currency, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(order_id) DO UPDATE SET
               fulfillment_status = CASE
                 WHEN orders.fulfillment_status IN ('entregado','devuelto','destruido','franquicia','en_transito')
                 THEN orders.fulfillment_status
                 ELSE EXCLUDED.fulfillment_status
               END,
               tracking_number = COALESCE(EXCLUDED.tracking_number, orders.tracking_number)`,
            [shop.id, String(o.id), o.name || String(o.order_number), customerName, mapSyncStatus(o), o.fulfillments?.[0]?.tracking_number || null, o.total_price, o.currency, o.created_at]
          );
          total++;
        }
      } catch (e) { console.error("❌ Sync error for shop", shop.shop_domain, e.message, e.stack); }
    }
    console.log("✅ SYNC DONE, total:", total);
    res.json({ ok: true, synced: total });
  } catch (e) {
    console.error("❌ SYNC GLOBAL ERROR:", e.message, e.stack);
    res.status(500).json({ error: "Error sync" });
  }
});