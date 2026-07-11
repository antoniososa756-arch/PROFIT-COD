const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// TEMPORAL: diagnóstico de solo lectura — ver el XML real de historial completo de MRW
const DEBUG_SECRET = "f813cf3a3da4bd52322c170ad28b55014e7b3763";
router.get("/debug-mrw-history/:tracking", async (req, res) => {
  if (req.query.secret !== DEBUG_SECRET) return res.status(403).json({ error: "forbidden" });
  try {
    const admin = await db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (!admin) return res.json({ error: "no hay usuario admin" });
    const creds = await db.get("SELECT login, pass FROM mrw_credentials WHERE user_id = $1", [admin.id]);
    if (!creds) return res.json({ error: "el admin no tiene credenciales MRW" });

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:GetEnvios>
      <tem:login>${creds.login}</tem:login>
      <tem:pass>${creds.pass}</tem:pass>
      <tem:codigoIdioma>3082</tem:codigoIdioma>
      <tem:tipoFiltro>0</tem:tipoFiltro>
      <tem:valorFiltroDesde>${req.params.tracking}</tem:valorFiltroDesde>
      <tem:valorFiltroHasta>${req.params.tracking}</tem:valorFiltroHasta>
      <tem:fechaDesde></tem:fechaDesde>
      <tem:fechaHasta></tem:fechaHasta>
      <tem:tipoInformacion>1</tem:tipoInformacion>
    </tem:GetEnvios>
  </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch("https://trackingservice.mrw.es/TrackingService.svc/TrackingServices", {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "http://tempuri.org/ITrackingService/GetEnvios" },
      body: soapBody,
      signal: AbortSignal.timeout(10000),
    });
    const xml = await response.text();
    res.json({ status: response.status, xmlLength: xml.length, xml });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

