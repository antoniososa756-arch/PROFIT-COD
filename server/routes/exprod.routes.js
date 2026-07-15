const express = require("express");
const router = express.Router();
const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

router.get("/product", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL requerida" });

  try {
    // Quitar query string (?fbclid=..., ?variant=..., etc.) y hash antes de construir
    // la URL del JSON — si no, ".json" se pega detrás de esos parámetros y la URL
    // resultante ya no apunta al endpoint JSON de Shopify (devuelve la página HTML normal).
    const parsed = new URL(url.trim());
    const cleanPath = parsed.pathname.replace(/\/$/, "").replace(/\.json$/, "");
    const jsonUrl = `${parsed.origin}${cleanPath}.json`;
    const r = await fetch(jsonUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProfitCOD/1.0)" },
      redirect: "follow",
    });
    if (!r.ok) return res.status(r.status).json({ error: `Error ${r.status} al acceder al producto` });
    const data = await r.json();
    if (!data.product) return res.status(404).json({ error: "No se encontró el producto en esa URL" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || "Error al obtener el producto" });
  }
});

module.exports = router;
