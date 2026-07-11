const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// TEMPORAL: diagnóstico de solo lectura — ver el HTML público de tracking de MRW
const DEBUG_SECRET = "b9f2e4c7a1d83f60e2b7c4a9d5f13e8c6b0a7d4f";
router.get("/debug-mrw-page/:tracking", async (req, res) => {
  if (req.query.secret !== DEBUG_SECRET) return res.status(403).json({ error: "forbidden" });
  try {
    const response = await fetch(
      `https://www.mrw.es/seguimiento_envios/MRW_historico_nacional.asp?enviament=${encodeURIComponent(req.params.tracking)}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36" },
        signal: AbortSignal.timeout(10000),
      }
    );
    const html = await response.text();
    res.json({ status: response.status, htmlLength: html.length, html });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

