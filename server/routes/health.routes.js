const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// TEMPORAL: diagnóstico de solo lectura — ver el WSDL del servicio MRW
const DEBUG_SECRET = "7a2c9e5f1b4d80c3a6e9f2b5d8c1a4e7f0b3d6c9";
router.get("/debug-mrw-wsdl", async (req, res) => {
  if (req.query.secret !== DEBUG_SECRET) return res.status(403).json({ error: "forbidden" });
  try {
    const url = req.query.xsd
      ? `https://trackingservice.mrw.es/TrackingService.svc?xsd=${req.query.xsd}`
      : "https://trackingservice.mrw.es/TrackingService.svc?wsdl";
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    res.json({ status: response.status, length: text.length, text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

