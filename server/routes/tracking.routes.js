const express = require("express");
const auth = require("../middlewares/auth");
const multer = require("multer");
const XLSX = require("xlsx");
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function mapMRWStatus(texto) {
  const t = (texto || "").toLowerCase();
  if (t.includes("entregado")) return "entregado";
  if (t.includes("devuelto")) return "devuelto";
  if (t.includes("destruir") || t.includes("destruido")) return "destruido";
  if (t.includes("pendiente de recoger en franquicia")) return "franquicia";
  if (t.includes("pendiente de recoger")) return "pendiente";
  return "en_transito";
}

// Extrae el mensaje de error/rechazo que MRW devuelve en <MensajeSeguimiento>
// cuando el envío consultado no pertenece a la cuenta/franquicia autenticada.
function extractMrwFault(xml) {
  const m = xml.match(/<[^:]*:?MensajeSeguimiento[^>]*>([^<]+)<\/[^:]*:?MensajeSeguimiento>/);
  return m && m[1].trim() ? m[1].trim() : null;
}

// Comprueba el login/pass contra MRW antes de guardarlos. Solo bloquea el guardado
// cuando MRW rechaza explícitamente el usuario/contraseña — cualquier otra respuesta
// (incluido "no pertenecen a esta franquicia", que es un problema de otro tipo, o un
// fallo de red/timeout) deja guardar igualmente para no bloquear al usuario.
async function validateMrwCredentials(login, pass, sampleTracking) {
  // "0" como filtro no dispara la misma comprobación de credenciales que MRW hace con
  // un número de seguimiento real — hay que usar algo con pinta de tracking de verdad
  // (real si lo tenemos, o uno con formato plausible) para que el rechazo de login sea fiable.
  const testValue = sampleTracking || "00000F000000";
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:GetEnvios>
      <tem:login>${login}</tem:login>
      <tem:pass>${pass}</tem:pass>
      <tem:codigoIdioma>3082</tem:codigoIdioma>
      <tem:tipoFiltro>0</tem:tipoFiltro>
      <tem:valorFiltroDesde>${testValue}</tem:valorFiltroDesde>
      <tem:valorFiltroHasta>${testValue}</tem:valorFiltroHasta>
      <tem:fechaDesde></tem:fechaDesde>
      <tem:fechaHasta></tem:fechaHasta>
      <tem:tipoInformacion>1</tem:tipoInformacion>
    </tem:GetEnvios>
  </soapenv:Body>
</soapenv:Envelope>`;
  try {
    const response = await fetch("https://trackingservice.mrw.es/TrackingService.svc/TrackingServices", {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "http://tempuri.org/ITrackingService/GetEnvios" },
      body: soapBody,
      signal: AbortSignal.timeout(8000),
    });
    const xml = await response.text();

    // Si la respuesta no es el XML/SOAP esperado (p.ej. una página de error del
    // proxy/firewall de MRW), no podemos concluir nada — no lo demos por válido a ciegas.
    if (!response.ok || !/<[^:]*:?Envelope/i.test(xml)) {
      return { valid: true, warning: "No se pudo verificar con MRW en este momento (respuesta inesperada). Se guardó igualmente — revisa que la sincronización funcione." };
    }

    const fault = extractMrwFault(xml);
    if (fault && /usuario.*(password|contraseñ)|password.*usuario|no son correctos/i.test(fault)) {
      return { valid: false, reason: fault };
    }
    return { valid: true };
  } catch (e) {
    return { valid: true, warning: "No se pudo verificar con MRW en este momento (puede estar caído). Se guardó igualmente." };
  }
}

// El histórico de MRW viene en orden ascendente (más antiguo primero).
// Prioriza estados finales (entregado/devuelto/destruido) si aparecen en algún punto;
// si no, usa el último elemento (más reciente).
function resolveStatusFromHistory(allEstados) {
  const FINAL = ["entregado", "devuelto", "destruido"];
  for (const txt of allEstados) {
    const s = mapMRWStatus(txt);
    if (FINAL.includes(s)) return s;
  }
  return mapMRWStatus(allEstados[allEstados.length - 1]);
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
  try {
    await req.db.run(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_mrw_check TEXT`);
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

  const sample = await req.db.get(
    `SELECT tracking_number FROM orders o
     WHERE (o.shop_id IN (SELECT id FROM shops WHERE user_id = $1) OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
       AND tracking_number IS NOT NULL AND tracking_number != ''
     LIMIT 1`,
    [req.user.id]
  ).catch(() => null);

  const check = await validateMrwCredentials(login, pass, sample?.tracking_number);
  if (!check.valid) {
    return res.status(400).json({ error: `MRW rechazó estas credenciales: ${check.reason}` });
  }

  try {
    await req.db.run(`
      INSERT INTO mrw_credentials (user_id, login, pass, franquicia, abonado)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET login = EXCLUDED.login, pass = EXCLUDED.pass,
        franquicia = EXCLUDED.franquicia, abonado = EXCLUDED.abonado
    `, [req.user.id, login, pass, franquicia || "", abonado || ""]);
    res.json({ ok: true, warning: check.warning || null });
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
// Estado global de sync MRW por usuario
if (!global.__mrwSyncStatus) global.__mrwSyncStatus = {};

router.get("/mrw-sync-status", auth, async (req, res) => {
  const status = global.__mrwSyncStatus[req.user.id] || { running: false, total: 0, done: 0 };
  res.json(status);
});

// ── POST sync un solo pedido por tracking_number ─────────────────────────────
router.post("/mrw-sync-one", auth, async (req, res) => {
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId requerido" });
  try {
    const creds = await req.db.get(
      "SELECT login, pass FROM mrw_credentials WHERE user_id = $1",
      [req.user.id]
    );
    if (!creds) return res.status(400).json({ error: "MRW no integrado" });

    const order = await req.db.get(
      `SELECT o.id, o.tracking_number, o.fulfillment_status
       FROM orders o
       WHERE o.id = $1
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $2)
           OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2))`,
      [orderId, req.user.id]
    );
    if (!order?.tracking_number) return res.status(404).json({ error: "Pedido no encontrado o sin tracking" });

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
      <tem:tipoInformacion>1</tem:tipoInformacion>
    </tem:GetEnvios>
  </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch("https://trackingservice.mrw.es/TrackingService.svc/TrackingServices", {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "http://tempuri.org/ITrackingService/GetEnvios" },
      body: soapBody,
      signal: AbortSignal.timeout(10000)
    });
    const xml = await response.text();
    console.log(`[MRW-ONE] XML para ${order.tracking_number}:`, xml.slice(0, 1200));
    await req.db.run("UPDATE orders SET last_mrw_check = now()::text WHERE id = $1", [order.id]);

    // tipoInformacion=1 devuelve histórico completo — coger el primer EstadoDescripcion no-nil (más reciente)
    const allEstados = [...xml.matchAll(/<[^:]*:?EstadoDescripcion[^>]*>([^<]+)<\/[^:]*:?EstadoDescripcion>/g)]
      .map(m => m[1].trim()).filter(Boolean);

    // Fallback: si HoraEntrega tiene valor real → fue entregado
    const horaEntregaMatch = xml.match(/<[^:]*:?HoraEntrega[^>]*>([^<]+)<\/[^:]*:?HoraEntrega>/);
    if (!allEstados.length && horaEntregaMatch) {
      const nuevoStatus = "entregado";
      if (nuevoStatus !== order.fulfillment_status) {
        await req.db.run("UPDATE orders SET fulfillment_status = $1, updated_at = now()::text WHERE id = $2", [nuevoStatus, order.id]);
      }
      return res.json({ ok: true, updated: nuevoStatus !== order.fulfillment_status, status: nuevoStatus });
    }

    if (!allEstados.length) {
      const mrwFault = extractMrwFault(xml);
      if (mrwFault) {
        return res.json({ ok: true, updated: false, status: order.fulfillment_status, mrwError: mrwFault });
      }
      const allTags = [...xml.matchAll(/<([A-Za-z:]+)[^>]*>([^<]{1,80})</g)].map(m => `${m[1]}: ${m[2]}`).slice(0, 10);
      return res.json({ ok: true, updated: false, status: order.fulfillment_status, debug: allTags });
    }

    const nuevoStatus = resolveStatusFromHistory(allEstados);
    console.log(`[MRW-ONE] ${order.tracking_number} → ${allEstados.join(" | ")} → ${nuevoStatus}`);
    if (nuevoStatus !== order.fulfillment_status) {
      await req.db.run("UPDATE orders SET fulfillment_status = $1, updated_at = now()::text WHERE id = $2", [nuevoStatus, order.id]);
    }
    res.json({ ok: true, updated: nuevoStatus !== order.fulfillment_status, status: nuevoStatus });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET historial completo de seguimiento MRW de un pedido ───────────────
router.get("/mrw-history/:orderId", auth, async (req, res) => {
  try {
    const creds = await req.db.get(
      "SELECT login, pass FROM mrw_credentials WHERE user_id = $1",
      [req.user.id]
    );
    if (!creds) return res.status(400).json({ error: "MRW no integrado" });

    const order = await req.db.get(
      `SELECT o.id, o.tracking_number
       FROM orders o
       WHERE o.id = $1
         AND (o.shop_id IN (SELECT id FROM shops WHERE user_id = $2)
           OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $2))`,
      [req.params.orderId, req.user.id]
    );
    if (!order?.tracking_number) return res.status(404).json({ error: "Pedido no encontrado o sin tracking" });

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

    // Los eventos individuales viven dentro de <SeguimientoAbonado>; fuera de ahí
    // el mismo tag "Seguimiento" también envuelve toda la respuesta, así que hay
    // que acotar el ámbito primero para no capturar ese nodo exterior.
    const scope = xml.match(/<[^:]*:?SeguimientoAbonado[^>]*>([\s\S]*?)<\/[^:]*:?SeguimientoAbonado>/);
    if (!scope) {
      const mrwFault = extractMrwFault(xml);
      return res.json({ history: [], mrwError: mrwFault || null });
    }

    const eventBlocks = [...scope[1].matchAll(/<[^:]*:?Seguimiento>([\s\S]*?)<\/[^:]*:?Seguimiento>/g)].map(m => m[1]);
    const history = eventBlocks.map(block => {
      const descripcion = block.match(/<[^:]*:?EstadoDescripcion[^>]*>([^<]+)<\/[^:]*:?EstadoDescripcion>/);
      const publicado = block.match(/<[^:]*:?Publicado[^>]*>([^<]+)<\/[^:]*:?Publicado>/);
      const personaEntrega = block.match(/<[^:]*:?PersonaEntrega[^>]*>([^<]+)<\/[^:]*:?PersonaEntrega>/);
      if (!descripcion || !publicado) return null;

      const fh = publicado[1].match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      return {
        estado: descripcion[1].trim(),
        fecha: fh ? `${fh[3]}/${fh[2]}/${fh[1]}` : "",
        hora: fh ? `${fh[4]}:${fh[5]}` : "",
        personaEntrega: personaEntrega ? personaEntrega[1].trim() : null,
      };
    }).filter(Boolean);

    if (!history.length) {
      const mrwFault = extractMrwFault(xml);
      return res.json({ history: [], mrwError: mrwFault || null });
    }

    res.json({ history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
      LEFT JOIN shops s ON s.id = o.shop_id
      WHERE (s.user_id = $1 OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
        AND o.tracking_number IS NOT NULL
        AND o.tracking_number != ''
        AND o.fulfillment_status NOT IN ('entregado','devuelto','destruido','cancelado')
    ORDER BY o.last_mrw_check ASC NULLS FIRST
    LIMIT 170
    `, [req.user.id]);

    if (!orders.length) return res.json({ ok: true, updated: 0, total: 0 });

    let updated = 0;
    const errors = [];
    let mrwFault = null; // primer mensaje de rechazo de MRW visto en esta pasada (si lo hay)

    global.__mrwSyncStatus[req.user.id] = { running: true, total: orders.length, done: 0 };

    // IMPORTANTE: cada pedido de esta tanda debe intentarse y actualizar su last_mrw_check
    // siempre (éxito, fallo o rechazo de MRW). Si no, ORDER BY last_mrw_check ASC NULLS FIRST
    // vuelve a seleccionar los mismos pedidos fallidos una y otra vez, dejando al resto
    // sin comprobar nunca — por eso el try/catch/finally de abajo actualiza siempre.
    for (const order of orders) {
      try {
        await new Promise(r => setTimeout(r, 140));
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
      <tem:tipoInformacion>1</tem:tipoInformacion>
    </tem:GetEnvios>
  </soapenv:Body>
</soapenv:Envelope>`;

        const response = await fetch("https://trackingservice.mrw.es/TrackingService.svc/TrackingServices", {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "http://tempuri.org/ITrackingService/GetEnvios"
          },
          body: soapBody
        });

        const xml = await response.text();

        // tipoInformacion=1 → histórico completo, coger el primer EstadoDescripcion no-nil (más reciente)
        const allEstados = [...xml.matchAll(/<[^:]*:?EstadoDescripcion[^>]*>([^<]+)<\/[^:]*:?EstadoDescripcion>/g)]
          .map(m => m[1].trim()).filter(Boolean);

        // Fallback: HoraEntrega con valor real → entregado
        const horaEntregaMatch = xml.match(/<[^:]*:?HoraEntrega[^>]*>([^<]+)<\/[^:]*:?HoraEntrega>/);
        let estadoTexto;
        if (!allEstados.length && horaEntregaMatch) {
          estadoTexto = "entregado";
        } else if (!allEstados.length) {
          if (!mrwFault) mrwFault = extractMrwFault(xml);
          errors.push(order.tracking_number);
          continue;
        } else {
          estadoTexto = null;
        }

        const nuevoStatus = estadoTexto === "entregado"
          ? "entregado"
          : resolveStatusFromHistory(allEstados);
        console.log(`MRW: tracking ${order.tracking_number} → ${nuevoStatus}`);

        // Solo contar como actualización real si hay cambio significativo.
        // "en_transito" es el estado por defecto del mapeo — no sobreescribir
        // estados equivalentes (enviado, en_preparacion) con en_transito.
        const estadosEnProgreso = ['enviado', 'en_preparacion', 'en_transito'];
        const esCambioRedundante = nuevoStatus === 'en_transito' && estadosEnProgreso.includes(order.fulfillment_status);

        if (nuevoStatus !== order.fulfillment_status && !esCambioRedundante) {
          await req.db.run(
            "UPDATE orders SET fulfillment_status = $1, updated_at = now()::text WHERE id = $2",
            [nuevoStatus, order.id]
          );
          updated++;
        }
      } catch(e) {
        console.error(`MRW fetch ERROR para ${order.tracking_number}:`, e.message);
        errors.push(order.tracking_number);
      } finally {
        global.__mrwSyncStatus[req.user.id].done++;
        await req.db.run("UPDATE orders SET last_mrw_check = now()::text WHERE id = $1", [order.id]).catch(() => {});
      }
    }

    global.__mrwSyncStatus[req.user.id] = { running: false, total: orders.length, done: orders.length };
    res.json({
      ok: true,
      updated,
      total: orders.length,
      errors,
      mrwError: mrwFault ? `MRW rechazó ${errors.length} consulta${errors.length === 1 ? "" : "s"}: ${mrwFault}. Revisa las credenciales en Integraciones → Agencia de envío.` : null,
    });
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
      else if (estadoRaw.includes("devuelto")) status = "devuelto";
      else if (estadoRaw.includes("destruir") || estadoRaw.includes("destruido")) status = "destruido";
      else if (estadoRaw.includes("recoger en franquicia") || estadoRaw.includes("franquicia destino") || estadoRaw.includes("concertada en franquicia") || estadoRaw.includes("entrega en franquicia") || estadoRaw.includes("pendiente de recoger en franquicia")) status = "franquicia";
      else if (estadoRaw.includes("pendiente de recoger")) status = "pendiente";

      const result = await req.db.run(
        `UPDATE orders SET fulfillment_status = $1 WHERE tracking_number = $2 AND (SELECT shop_domain FROM shops WHERE id = shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $3)`,
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