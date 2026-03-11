const express = require("express");
const auth = require("../middlewares/auth");
const router = express.Router();

// Mapa de estados MRW → PROFICOD
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
    const response = await fetch("https://www.mrw.es/seguimiento_envios/MRW_historico_nacional.asp", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.mrw.es/seguimiento/envio.asp",
      },
      body: `enviament=${tracking}`,
    });

    const html = await response.text();

    // Extraer estado del HTML
    const match = html.match(/Estado envío[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i) ||
                  html.match(/<td[^>]*class="[^"]*estado[^"]*"[^>]*>([\s\S]*?)<\/td>/i);

    if (!match) {
      // Intentar buscar texto del estado directamente
      const statusMatch = html.match(/Env[ií]o\s+(entregado|en tr[aá]nsito|devuelto|destruido)/i);
      if (statusMatch) {
        const rawStatus = statusMatch[0].trim();
        return res.json({ ok: true, raw: rawStatus, status: mapMRWStatus(rawStatus) });
      }
      return res.json({ ok: false, error: "No se pudo leer el estado" });
    }

    const rawStatus = match[1].replace(/<[^>]+>/g, "").trim();
    res.json({ ok: true, raw: rawStatus, status: mapMRWStatus(rawStatus) });

  } catch (err) {
    console.error("MRW scraping error:", err);
    res.status(500).json({ error: "Error consultando MRW" });
  }
});

module.exports = router;