const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_TOKEN;

async function getOrders() {
  const url = `https://${SHOP}/admin/api/2023-10/orders.json?status=any&limit=10`;

  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  const data = await res.json();
  return data.orders || [];
}

module.exports = { getOrders };
