// Sugerencias de direcciones para "Editar dirección de envío" con Google
// Places (API New), igual que Shopify. La clave va en la variable de entorno
// GOOGLE_MAPS_KEY del servidor (nunca llega al navegador). Sin clave, el
// navegador usa OpenStreetMap (Photon) como hasta ahora.
const express = require("express");
const auth = require("../middlewares/auth");
const router = express.Router();

const KEY = () => (process.env.GOOGLE_MAPS_KEY || "").trim();

// GET /api/direcciones/sugerencias?q=...&pais=ES&sesion=...
// "sesion" agrupa las teclas de una misma búsqueda con el detalle elegido:
// Google cobra la sesión entera como una sola, no cada tecla.
router.get("/sugerencias", auth, async (req, res) => {
  if (!KEY()) return res.json({ proveedor: "osm" });
  const q = String(req.query.q || "").trim();
  const pais = String(req.query.pais || "ES").toUpperCase().slice(0, 2);
  if (q.length < 3) return res.json({ proveedor: "google", sugerencias: [] });
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY() },
      body: JSON.stringify({
        input: q,
        includedRegionCodes: [pais.toLowerCase()],
        languageCode: "es",
        sessionToken: String(req.query.sesion || "").slice(0, 64) || undefined,
      }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("[Direcciones] Google autocomplete:", r.status, data?.error?.message);
      return res.json({ proveedor: "osm" }); // que el navegador use OpenStreetMap
    }
    const sugerencias = (data.suggestions || [])
      .map(s => s.placePrediction)
      .filter(Boolean)
      .map(p => ({ id: p.placeId, texto: p.text?.text || "" }));
    res.json({ proveedor: "google", sugerencias });
  } catch (e) {
    console.error("[Direcciones] Google autocomplete:", e.message);
    res.json({ proveedor: "osm" });
  }
});

// GET /api/direcciones/detalle/:id?sesion=... — calle, número, CP, ciudad y
// provincia de la sugerencia elegida.
router.get("/detalle/:id", auth, async (req, res) => {
  if (!KEY()) return res.status(400).json({ error: "Sin clave de Google" });
  try {
    const sesion = String(req.query.sesion || "").slice(0, 64);
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(req.params.id)}?languageCode=es${sesion ? `&sessionToken=${encodeURIComponent(sesion)}` : ""}`;
    const r = await fetch(url, {
      headers: { "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "addressComponents" },
      signal: AbortSignal.timeout(6000),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || "Error de Google" });
    const comp = tipo => (data.addressComponents || []).find(c => (c.types || []).includes(tipo))?.longText || "";
    const calle = comp("route"), num = comp("street_number");
    res.json({
      dir1: [calle, num].filter(Boolean).join(" "),
      cp: comp("postal_code"),
      ciudad: comp("locality") || comp("postal_town") || comp("administrative_area_level_3"),
      // En España la provincia es administrative_area_level_2 (level_1 es la comunidad)
      prov: comp("administrative_area_level_2") || comp("administrative_area_level_1"),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
