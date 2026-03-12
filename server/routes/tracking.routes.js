const express = require("express");
const auth = require("../middlewares/auth");
const router = express.Router();

function mapMRWStatus(texto) {
  const t = (texto || "").toLowerCase();
  if (t.includes("entregado")) return "entregado";
  if (t.includes("reparto")) return "en_reparto";
  if (t.includes("tránsito") || t.includes("transito") || t.includes("tr&#225;nsito")) return "en_transito";
  if (t.includes("devuelto") || t.includes("retorno")) return "devuelto";
  if (t.includes("destruido")) return "destruido";
  if (t.includes("ausente") || t.includes("no entregado")) return "no_entregado";
  if (t.includes("pendiente")) return "pendiente";
  return "en_transito";
}

// Guardar credenciales MRW (ya no necesarias pero las dejamos por si acaso)
router.post("/credentials", auth, async (req, res) => {
  res.json({ ok: true });
});

router.get("/:tracking", auth, async (req, res) => {
  const { tracking } = req.params;

  try {
    const url = `https://www.mrw.es/seguimiento/envio-actual.asp?nAlbaran=${encodeURIComponent(tracking)}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
        "Referer": "https://www.mrw.es/",
      }
    });

    const html = await response.text();

    // Extraer estado del td
    console.log("MRW HTML SNIPPET:", html.substring(html.indexOf("Estado"), html.indexOf("Estado") + 200));
    const match = html.match(/data-title="Estado env[^"]*"[^>]*>([^<]+)</);
    if (!match) {
      return res.json({ ok: false, error: "No se encontró el estado en MRW" });
    }

    // Limpiar caracteres especiales
    const raw = match[1]
      .replace(/EnvÃ­o/g, "Envío")
      .replace(/trÃ¡nsito/g, "tránsito")
      .replace(/&[a-z]+;/g, "")
      .trim();

    res.json({ ok: true, raw, status: mapMRWStatus(raw) });

  } catch (err) {
    console.error("MRW scraping error:", err);
    res.status(500).json({ error: "Error consultando MRW" });
  }
});

module.exports = router;