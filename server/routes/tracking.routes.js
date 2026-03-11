const express = require("express");
const auth = require("../middlewares/auth");
const router = express.Router();

function mapMRWStatus(texto) {
  const t = (texto || "").toLowerCase();
  if (t.includes("entregado")) return "entregado";
  if (t.includes("tr\u00e1nsito") || t.includes("transito") || t.includes("camino")) return "en_transito";
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

    // Buscar directamente palabras clave de estado
    const keywords = [
      "Env\u00edo entregado",
      "Entregado",
      "En tr\u00e1nsito",
      "En transito",
      "Devuelto",
      "Destruido",
      "No entregado",
      "Ausente",
    ];

    let rawStatus = null;
    for (const kw of keywords) {
      if (html.toLowerCase().includes(kw.toLowerCase())) {
        rawStatus = kw;
        break;
      }
    }

    if (!rawStatus) {
      return res.json({ ok: false, error: "Estado no encontrado", html: html.substring(0, 800) });
    }

    res.json({ ok: true, raw: rawStatus, status: mapMRWStatus(rawStatus) });

  } catch (err) {
    console.error("MRW scraping error:", err);
    res.status(500).json({ error: "Error consultando MRW" });
  }
});

module.exports = router;