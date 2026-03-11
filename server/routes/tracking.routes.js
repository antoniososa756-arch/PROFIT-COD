const express = require("express");
const auth = require("../middlewares/auth");
const router = express.Router();

function mapMRWStatus(texto) {
  const t = (texto || "").toLowerCase();
  if (t.includes("entregado")) return "entregado";
  if (t.includes("tránsito") || t.includes("transito") || t.includes("camino")) return "en_transito";
  if (t.includes("devuelto") || t.includes("retorno")) return "devuelto";
  if (t.includes("destruido")) return "destruido";
  if (t.includes("ausente") || t.includes("no entregado")) return "no_entregado";
  return "en_transito";
}

router.get("/:tracking", auth, async (req, res) => {
  const { tracking } = req.params;

  try {
    const response = await fetch(
      `https://www.mrw.es/seguimiento_envios/MRW_historico_nacional.asp?enviament=${tracking}`,
      {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9",
          "Referer": "https://www.mrw.es/seguimiento/envio.asp",
        },
      }
    );

    const html = await response.text();

    // Buscar estado en el HTML
    const statusMatch = html.match(/Env[ií]o\s+\w+/i) ||
                        html.match(/Estado[^<]*<\/td>\s*<td[^>]*>([^<]+)/i) ||
                        html.match(/(entregado|en tr[aá]nsito|devuelto|destruido|no entregado)/i);

    if (!statusMatch) {
      return res.json({ ok: false, error: "Estado no encontrado", html: html.substring(0, 500) });
    }

    const rawStatus = statusMatch[0].trim();
    res.json({ ok: true, raw: rawStatus, status: mapMRWStatus(rawStatus) });

  } catch (err) {
    console.error("MRW scraping error:", err);
    res.status(500).json({ error: "Error consultando MRW" });
  }
});

module.exports = router;