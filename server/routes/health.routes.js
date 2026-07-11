const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// TEMPORAL: diagnóstico de solo lectura — consulta MRW directo para un tracking concreto
const DEBUG_SECRET = "12355557d2666d06f6ea715a3063fc2eb44b74d9";
router.get("/debug-mrw/:tracking", async (req, res) => {
  if (req.query.secret !== DEBUG_SECRET) return res.status(403).json({ error: "forbidden" });
  try {
    const order = await db.get(
      `SELECT o.id, o.order_number, o.fulfillment_status, o.shop_id, s.user_id
       FROM orders o LEFT JOIN shops s ON s.id = o.shop_id
       WHERE o.tracking_number = $1`,
      [req.params.tracking]
    );
    if (!order) return res.json({ error: "pedido no encontrado con ese tracking" });

    const creds = await db.get("SELECT login, pass FROM mrw_credentials WHERE user_id = $1", [order.user_id]);
    if (!creds) return res.json({ error: "sin credenciales MRW para ese usuario", order });

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

    const allEstados = [...xml.matchAll(/<[^:]*:?EstadoDescripcion[^>]*>([^<]+)<\/[^:]*:?EstadoDescripcion>/g)].map(m => m[1].trim());
    const horaEntrega = xml.match(/<[^:]*:?HoraEntrega[^>]*>([^<]*)<\/[^:]*:?HoraEntrega>/);
    const fechas = [...xml.matchAll(/<[^:]*:?FechaEstado[^>]*>([^<]*)<\/[^:]*:?FechaEstado>/g)].map(m => m[1].trim());

    res.json({ order, allEstados, horaEntrega: horaEntrega ? horaEntrega[1] : null, fechas, xmlLength: xml.length, xmlSnippet: xml });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

