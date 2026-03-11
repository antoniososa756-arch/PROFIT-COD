const express = require("express");
const auth = require("../middlewares/auth");
const router = express.Router();

function mapMRWStatus(texto) {
  const t = (texto || "").toLowerCase();
  if (t.includes("entregado")) return "entregado";
  if (t.includes("tránsito") || t.includes("transito")) return "en_transito";
  if (t.includes("devuelto") || t.includes("retorno")) return "devuelto";
  if (t.includes("destruido")) return "destruido";
  if (t.includes("ausente") || t.includes("no entregado")) return "no_entregado";
  return "en_transito";
}

router.get("/:tracking", auth, async (req, res) => {
  const { tracking } = req.params;

  try {
    // PASO 1: obtener cookies de sesión
    const sessionRes = await fetch("https://www.mrw.es/seguimiento/envio.asp", {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });

    const cookies = sessionRes.headers.get("set-cookie") || "";

    // PASO 2: enviar el tracking con las cookies
    const trackRes = await fetch("https://www.mrw.es/seguimiento/envio-actual.asp", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
        "Referer": "https://www.mrw.es/seguimiento/envio.asp",
        "Cookie": cookies,
      },
      body: `Buscar=${tracking}&from=buscar`,
    });

    const html = await trackRes.text();

    const keywords = [
      "Envío entregado", "Entregado",
      "En tránsito", "En transito",
      "Devuelto", "Destruido",
      "No entregado", "Ausente",
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