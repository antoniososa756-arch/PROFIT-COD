const express = require("express");
const auth = require("../middlewares/auth");
const multer = require("multer");
const XLSX = require("xlsx");
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function mapMRWStatus(texto) {
  const t = (texto || "").toLowerCase();
  if (t.includes("entregado")) return "entregado";
  if (t.includes("devuelto") || t.includes("retorno") || t.includes("no acepta")) return "devuelto";
  if (t.includes("destruir") || t.includes("destruido")) return "destruido";
  if (t.includes("recoger en franquicia") || t.includes("franquicia destino")) return "franquicia";
  return "en_transito";
}

// ── Crear tabla credenciales MRW ──────────────────────────────
router.use(async (req, res, next) => {
  try {
    await req.db.run(`
      CREATE TABLE IF NOT EXISTS mrw_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        login TEXT NOT NULL,
        pass TEXT NOT NULL,
        franquicia TEXT,
        abonado TEXT,
        created_at TEXT DEFAULT now()::text
      )
    `);
  } catch(e) {}
  next();
});

// ── GET credenciales MRW del usuario ─────────────────────────
router.get("/mrw-credentials", auth, async (req, res) => {
  try {
    const row = await req.db.get(
      "SELECT login, franquicia, abonado FROM mrw_credentials WHERE user_id = $1",
      [req.user.id]
    );
    res.json({ integrated: !!row, login: row?.login || "", franquicia: row?.franquicia || "", abonado: row?.abonado || "" });
  } catch(e) {
    res.json({ integrated: false });
  }
});

// ── POST guardar credenciales MRW ────────────────────────────
router.post("/mrw-credentials", auth, async (req, res) => {
  const { login, pass, franquicia, abonado } = req.body || {};
  if (!login || !pass) return res.status(400).json({ error: "Login y contraseña requeridos" });
  try {
    await req.db.run(`
      INSERT INTO mrw_credentials (user_id, login, pass, franquicia, abonado)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET login = EXCLUDED.login, pass = EXCLUDED.pass,
        franquicia = EXCLUDED.franquicia, abonado = EXCLUDED.abonado
    `, [req.user.id, login, pass, franquicia || "", abonado || ""]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE eliminar integración MRW ──────────────────────────
router.delete("/mrw-credentials", auth, async (req, res) => {
  try {
    await req.db.run("DELETE FROM mrw_credentials WHERE user_id = $1", [req.user.id]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST sincronizar estados vía API MRW SOAP ─────────────────
router.post("/mrw-sync", auth, async (req, res) => {
  try {
    const creds = await req.db.get(
      "SELECT login, pass FROM mrw_credentials WHERE user_id = $1",
      [req.user.id]
    );
    if (!creds) return res.status(400).json({ error: "MRW no integrado" });

    const orders = await req.db.all(`
      SELECT o.id, o.tracking_number, o.fulfillment_status
      FROM orders o
      JOIN shops s ON s.id = o.shop_id
      WHERE s.user_id = $1
        AND o.tracking_number IS NOT NULL
        AND o.tracking_number != ''
        AND o.fulfillment_status NOT IN ('entregado','devuelto','destruido','cancelado')
    `, [req.user.id]);

    if (!orders.length) return res.json({ ok: true, updated: 0, total: 0 });

    let updated = 0;
    const errors = [];

    for (const order of orders) {
      try {
        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:GetEnvios>
      <tem:login>${creds.login}</tem:login>
      <tem:pass>${creds.pass}</tem:pass>
      <tem:codigoIdioma>3082</tem:codigoIdioma>
      <tem:tipoFiltro>0</tem:tipoFiltro>
      <tem:valorFiltroDesde>${order.tracking_number}</tem:valorFiltroDesde>
      <tem:valorFiltroHasta>${order.tracking_number}</tem:valorFiltroHasta>
      <tem:fechaDesde></tem:fechaDesde>
      <tem:fechaHasta></tem:fechaHasta>
      <tem:tipoInformacion>0</tem:tipoInformacion>
    </tem:GetEnvios>
  </soapenv:Body>
</soapenv:Envelope>`;

         console.log(`MRW: llamando API para ${order.tracking_number}...`);
        const response = await fetch("http://clientesbalanceo2.mrw.es/TrackingServices/TrackingService.svc", {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "http://tempuri.org/ITrackingService/GetEnvios"
          },
          body: soapBody
        });

        const xml = await response.text();
        // Guardar solo el primero para debug
        if (!global.__mrwDebugXml) {
          global.__mrwDebugXml = { tracking: order.tracking_number, xml };
          console.log(`MRW DEBUG guardado para tracking: ${order.tracking_number}`);
        }
        const estadoMatch = xml.match(/<[^:]*:?EstadoDescripcion[^>]*>([^<]+)<\/[^:]*:?EstadoDescripcion>/);
        if (!estadoMatch) { 
          console.log(`MRW: no se encontró estado para ${order.tracking_number}`);
          errors.push(order.tracking_number); 
          continue; 
        }
        console.log(`MRW: tracking ${order.tracking_number} → estado: ${estadoMatch[1]}`);

        const estadoTexto = estadoMatch[1].trim();
        const nuevoStatus = mapMRWStatus(estadoTexto);

        if (nuevoStatus !== order.fulfillment_status) {
          await req.db.run(
            "UPDATE orders SET fulfillment_status = $1, updated_at = now()::text WHERE id = $2",
            [nuevoStatus, order.id]
          );
          updated++;
        }
    } catch(e) {
        console.error(`MRW fetch ERROR para ${order.tracking_number}:`, e.message);
        errors.push(order.tracking_number);
      }
    }

    res.json({ ok: true, updated, total: orders.length, errors });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Ruta legacy ───────────────────────────────────────────────
router.post("/credentials", auth, async (req, res) => {
  res.json({ ok: true });
});

// ── POST sync desde Excel MRW ─────────────────────────────────
router.post("/sync-excel", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió archivo" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    let updated = 0;
    for (const row of rows) {
      const tracking = String(row["Número Envío"] || "").trim();
      const estadoRaw = String(row["Estado_1"] || "").trim().toLowerCase();
      if (!tracking || !estadoRaw) continue;

      let status = "en_transito";
      if (estadoRaw.includes("entregado")) status = "entregado";
      else if (estadoRaw.includes("devuelto") || estadoRaw.includes("no acepta") || estadoRaw.includes("retorno")) status = "devuelto";
      else if (estadoRaw.includes("destruir") || estadoRaw.includes("destruido")) status = "destruido";
      else if (estadoRaw.includes("recoger en franquicia") || estadoRaw.includes("franquicia destino")) status = "franquicia";

      const result = await req.db.run(
        `UPDATE orders SET fulfillment_status = $1 WHERE tracking_number = $2 AND shop_id IN (SELECT id FROM shops WHERE user_id = $3)`,
        [status, tracking, req.user.id]
      );
      if (result.rowCount > 0) updated++;
    }

    res.json({ ok: true, updated, total: rows.length });
  } catch (err) {
    console.error("Excel sync error:", err);
    res.status(500).json({ error: "Error procesando Excel" });
  }
});

// ── DEBUG temporal: ver XML de MRW ───────────────────────────
router.get("/mrw-debug-xml", async (req, res) => {
  res.json(global.__mrwDebugXml || { msg: "Aún no hay datos, sincroniza primero" });
});

module.exports = router;