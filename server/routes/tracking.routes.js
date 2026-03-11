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

  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetEnvio xmlns="http://www.mrw.es/">
      <CodigoAbonado>04700FANOMI</CodigoAbonado>
      <CodigoAbonado2></CodigoAbonado2>
      <NumerosEnvio>${tracking}</NumerosEnvio>
      <Username>04700FANOMI</Username>
      <Password>Sosa756**</Password>
    </GetEnvio>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch("https://www.mrw.es/webservices/MRWEnvio.asmx", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://www.mrw.es/GetEnvio",
      },
      body: soap,
    });

    const xml = await response.text();
    console.log("MRW SOAP response:", xml.substring(0, 500));

    // Extraer estado del XML
    const estadoMatch = xml.match(/<Estado>([^<]+)<\/Estado>/i) ||
                        xml.match(/<Situacion>([^<]+)<\/Situacion>/i) ||
                        xml.match(/<Descripcion>([^<]+)<\/Descripcion>/i);

    if (!estadoMatch) {
      return res.json({ ok: false, error: "No se pudo leer estado", xml: xml.substring(0, 500) });
    }

    const rawStatus = estadoMatch[1].trim();
    res.json({ ok: true, raw: rawStatus, status: mapMRWStatus(rawStatus) });

  } catch (err) {
    console.error("MRW SOAP error:", err);
    res.status(500).json({ error: "Error consultando MRW" });
  }
});

module.exports = router;