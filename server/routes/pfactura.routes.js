const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const { renderPFacturaPDF } = require("../utils/pfacturaPdf");
const router = express.Router();

async function getInvoiceWithItems(id, userId) {
  const invoice = await db.get("SELECT * FROM pfacturas WHERE id = ? AND user_id = ?", [id, userId]);
  if (!invoice) return null;
  const items = await db.all("SELECT * FROM pfactura_items WHERE pfactura_id = ? ORDER BY orden ASC, id ASC", [id]);
  const subtotal = items.reduce((a, i) => a + Number(i.cantidad) * Number(i.precio), 0);
  return { ...invoice, items, subtotal, total: subtotal, saldo: subtotal - Number(invoice.pagado || 0) };
}

// Emisor por defecto a partir de los datos de facturación de la cuenta (Perfil).
// Se usa solo para RELLENAR huecos que el usuario no especificó en la factura —
// cada factura guarda su propio emisor como una foto fija en el momento de
// crearla, así que si luego cambia sus datos de cuenta las facturas ya
// emitidas no se alteran retroactivamente.
async function getDefaultIssuer(userId) {
  const u = await db.get(
    "SELECT email, display_name, billing_name, billing_nif, billing_address, billing_city, billing_zip, billing_country FROM users WHERE id = ?",
    [userId]
  );
  const addressLines = [];
  if (u.billing_address) addressLines.push(u.billing_address);
  const cityLine = [u.billing_city, u.billing_zip].filter(Boolean).join(" ");
  if (cityLine) addressLines.push(cityLine);
  if (u.billing_country) addressLines.push(u.billing_country);
  return {
    nombre: u.billing_name || u.display_name || u.email,
    identificacion: u.billing_nif || "",
    direccion: addressLines.join("\n"),
    email: u.email,
  };
}

function issuerToPdfFormat(invoice) {
  return {
    name: invoice.emisor_nombre || "",
    taxIdLine: invoice.emisor_identificacion ? `NIF/CIF: ${invoice.emisor_identificacion}` : "",
    addressLines: invoice.emisor_direccion ? String(invoice.emisor_direccion).split("\n") : [],
    email: invoice.emisor_email || "",
  };
}

// GET /api/pfactura — listado con totales
router.get("/", auth, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT f.*, COALESCE(SUM(i.cantidad * i.precio), 0) AS total
      FROM pfacturas f
      LEFT JOIN pfactura_items i ON i.pfactura_id = f.id
      WHERE f.user_id = ?
      GROUP BY f.id
      ORDER BY f.id DESC
    `, [req.user.id]);
    res.json(rows.map(r => ({ ...r, total: Number(r.total), saldo: Number(r.total) - Number(r.pagado || 0) })));
  } catch (e) { console.error(e); res.status(500).json({ error: "Error BD" }); }
});

// GET /api/pfactura/:id — detalle con items
router.get("/:id", auth, async (req, res) => {
  try {
    const invoice = await getInvoiceWithItems(req.params.id, req.user.id);
    if (!invoice) return res.status(404).json({ error: "No encontrada" });
    res.json(invoice);
  } catch (e) { console.error(e); res.status(500).json({ error: "Error BD" }); }
});

function validateBody(body) {
  const { cliente_nombre, cliente_identificacion, items } = body || {};
  if (!cliente_nombre || !String(cliente_nombre).trim()) return "Falta el nombre del cliente";
  // Sin el DNI/NIF del cliente la factura no tiene validez fiscal.
  if (!cliente_identificacion || !String(cliente_identificacion).trim()) return "Falta el DNI/NIF del cliente — es obligatorio para que la factura tenga validez";
  if (!Array.isArray(items) || items.length === 0) return "Añade al menos un artículo";
  if (items.some(i => !i.descripcion || !String(i.descripcion).trim())) return "Cada artículo necesita una descripción";
  return null;
}

// POST /api/pfactura — crear factura + items, numeración automática por usuario
router.post("/", auth, async (req, res) => {
  const err = validateBody(req.body);
  if (err) return res.status(400).json({ error: err });
  const {
    fecha, vencimiento, terminos, cliente_nombre, notas, pagado, items,
    cliente_identificacion, cliente_email, cliente_telefono,
    cliente_direccion1, cliente_direccion2, cliente_ciudad, cliente_pais,
    emisor_nombre, emisor_identificacion, emisor_direccion, emisor_email,
  } = req.body;

  try {
    const defaultIssuer = await getDefaultIssuer(req.user.id);
    const seqRow = await db.get(
      "UPDATE users SET pfactura_seq = pfactura_seq + 1 WHERE id = ? RETURNING pfactura_seq",
      [req.user.id]
    );
    const numero = `INV-${String(seqRow.pfactura_seq).padStart(6, "0")}`;

    const result = await db.run(
      `INSERT INTO pfacturas (user_id, numero, fecha, vencimiento, terminos, cliente_nombre, notas, pagado,
        emisor_nombre, emisor_identificacion, emisor_direccion, emisor_email,
        cliente_identificacion, cliente_email, cliente_telefono, cliente_direccion1, cliente_direccion2, cliente_ciudad, cliente_pais)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [req.user.id, numero, fecha || new Date().toISOString().slice(0, 10), vencimiento || null, terminos || null,
       cliente_nombre.trim(), notas || null, parseFloat(pagado) || 0,
       (emisor_nombre || "").trim() || defaultIssuer.nombre,
       (emisor_identificacion || "").trim() || defaultIssuer.identificacion,
       (emisor_direccion || "").trim() || defaultIssuer.direccion,
       (emisor_email || "").trim() || defaultIssuer.email,
       cliente_identificacion.trim(), (cliente_email || "").trim() || null, (cliente_telefono || "").trim() || null,
       (cliente_direccion1 || "").trim() || null, (cliente_direccion2 || "").trim() || null,
       (cliente_ciudad || "").trim() || null, (cliente_pais || "").trim() || null]
    );
    const invoiceId = result.lastID;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.run(
        "INSERT INTO pfactura_items (pfactura_id, descripcion, cantidad, precio, orden) VALUES (?, ?, ?, ?, ?)",
        [invoiceId, it.descripcion.trim(), parseFloat(it.cantidad) || 1, parseFloat(it.precio) || 0, i]
      );
    }

    res.json({ id: invoiceId, numero });
  } catch (e) { console.error(e); res.status(500).json({ error: "Error guardando la factura" }); }
});

// PUT /api/pfactura/:id — editar cabecera + reemplazar items
router.put("/:id", auth, async (req, res) => {
  const err = validateBody(req.body);
  if (err) return res.status(400).json({ error: err });
  const {
    fecha, vencimiento, terminos, cliente_nombre, notas, pagado, items,
    cliente_identificacion, cliente_email, cliente_telefono,
    cliente_direccion1, cliente_direccion2, cliente_ciudad, cliente_pais,
    emisor_nombre, emisor_identificacion, emisor_direccion, emisor_email,
  } = req.body;

  try {
    const existing = await db.get("SELECT id FROM pfacturas WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (!existing) return res.status(404).json({ error: "No encontrada" });

    await db.run(
      `UPDATE pfacturas SET fecha = ?, vencimiento = ?, terminos = ?, cliente_nombre = ?, notas = ?, pagado = ?,
        emisor_nombre = ?, emisor_identificacion = ?, emisor_direccion = ?, emisor_email = ?,
        cliente_identificacion = ?, cliente_email = ?, cliente_telefono = ?,
        cliente_direccion1 = ?, cliente_direccion2 = ?, cliente_ciudad = ?, cliente_pais = ?
       WHERE id = ? AND user_id = ?`,
      [fecha, vencimiento || null, terminos || null, cliente_nombre.trim(),
       notas || null, parseFloat(pagado) || 0,
       (emisor_nombre || "").trim() || null, (emisor_identificacion || "").trim() || null,
       (emisor_direccion || "").trim() || null, (emisor_email || "").trim() || null,
       cliente_identificacion.trim(), (cliente_email || "").trim() || null, (cliente_telefono || "").trim() || null,
       (cliente_direccion1 || "").trim() || null, (cliente_direccion2 || "").trim() || null,
       (cliente_ciudad || "").trim() || null, (cliente_pais || "").trim() || null,
       req.params.id, req.user.id]
    );

    await db.run("DELETE FROM pfactura_items WHERE pfactura_id = ?", [req.params.id]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.run(
        "INSERT INTO pfactura_items (pfactura_id, descripcion, cantidad, precio, orden) VALUES (?, ?, ?, ?, ?)",
        [req.params.id, it.descripcion.trim(), parseFloat(it.cantidad) || 1, parseFloat(it.precio) || 0, i]
      );
    }

    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "Error actualizando la factura" }); }
});

// DELETE /api/pfactura/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.run("DELETE FROM pfacturas WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error eliminando" }); }
});

// GET /api/pfactura/:id/pdf — descarga en PDF
router.get("/:id/pdf", auth, async (req, res) => {
  try {
    const invoice = await getInvoiceWithItems(req.params.id, req.user.id);
    if (!invoice) return res.status(404).json({ error: "No encontrada" });
    // Facturas anteriores a añadir estos campos no tienen emisor_* guardado —
    // se rellenan con los datos de cuenta actuales solo en ese caso.
    if (!invoice.emisor_nombre) {
      const d = await getDefaultIssuer(req.user.id);
      invoice.emisor_nombre = d.nombre;
      invoice.emisor_identificacion = invoice.emisor_identificacion || d.identificacion;
      invoice.emisor_direccion = invoice.emisor_direccion || d.direccion;
      invoice.emisor_email = invoice.emisor_email || d.email;
    }
    renderPFacturaPDF(res, { issuer: issuerToPdfFormat(invoice), invoice, items: invoice.items });
  } catch (e) { console.error(e); res.status(500).json({ error: "Error generando el PDF" }); }
});

module.exports = router;
