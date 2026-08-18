const PDFDocument = require("pdfkit");

const ML = 50;
const MR = 545; // borde derecho del contenido (A4 = 595.28pt, margen 50)
const CW = MR - ML;

const GRAY_900 = "#111827";
const GRAY_700 = "#374151";
const GRAY_500 = "#6b7280";
const GRAY_400 = "#9ca3af";
const GRAY_200 = "#e5e7eb";
const HEADER_BG = "#1f2937";
const ACCENT = "#10b981";

function money(n) {
  return `${Number(n || 0).toFixed(2).replace(".", ",")}€`;
}
function num(n) {
  return Number(n || 0).toFixed(2).replace(".", ",");
}
function fmtDate(d) {
  if (!d) return "—";
  // Parseo manual de "YYYY-MM-DD" (evita el corrimiento de un día que causa
  // `new Date("YYYY-MM-DD")` al interpretarse como UTC y mostrarse en la
  // zona horaria local del servidor)
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return d;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// issuer:  { name, taxIdLine, addressLines[], email }
// invoice: { numero, fecha, vencimiento, terminos, cliente_nombre, cliente_direccion, notas, pagado, subtotal, total, saldo }
// items:   [{ descripcion, cantidad, precio }]
function renderPFacturaPDF(res, { issuer, invoice, items }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.numero}.pdf"`);
  doc.pipe(res);

  // ── Cabecera: emisor (izq) / FACTURA + número (dcha) ──────────────
  doc.font("Helvetica-Bold").fontSize(16).fillColor(GRAY_900)
    .text(issuer.name || "—", ML, 50, { width: 280 });

  doc.font("Helvetica").fontSize(24).fillColor(GRAY_900)
    .text("FACTURA", ML, 50, { width: CW, align: "right" });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(GRAY_700)
    .text(`# ${invoice.numero}`, ML, 78, { width: CW, align: "right" });

  // ── Datos del emisor (izq) / Saldo adeudado (dcha) ────────────────
  let y = 118;
  const issuerLines = [issuer.taxIdLine, ...(issuer.addressLines || []), issuer.email].filter(Boolean);
  doc.font("Helvetica").fontSize(9).fillColor(GRAY_500);
  issuerLines.forEach(line => {
    doc.text(line, ML, y, { width: 280 });
    y += 13;
  });

  doc.font("Helvetica").fontSize(9).fillColor(GRAY_500)
    .text("Saldo adeudado", ML, 118, { width: CW, align: "right" });
  doc.font("Helvetica-Bold").fontSize(15).fillColor(GRAY_900)
    .text(money(invoice.saldo), ML, 131, { width: CW, align: "right" });

  // ── Facturar a (izq) / fechas y términos (dcha) ───────────────────
  const blockY = Math.max(y + 14, 205);
  doc.font("Helvetica").fontSize(9).fillColor(GRAY_500).text("Facturar a", ML, blockY);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(GRAY_900)
    .text(invoice.cliente_nombre, ML, blockY + 14, { width: 280 });
  let clientY = blockY + 28;
  if (invoice.cliente_direccion) {
    doc.font("Helvetica").fontSize(9).fillColor(GRAY_500);
    String(invoice.cliente_direccion).split("\n").forEach(line => {
      doc.text(line, ML, clientY, { width: 280 });
      clientY += 12;
    });
  }

  const dateRows = [
    ["Fecha de la factura :", fmtDate(invoice.fecha)],
    ["Términos :", invoice.terminos || "Personalizada"],
    ["Fecha de vencimiento :", invoice.vencimiento ? fmtDate(invoice.vencimiento) : "—"],
  ];
  let dy = blockY;
  const labelW = 150, valW = 130;
  const labelX = MR - labelW - valW - 8, valX = MR - valW;
  dateRows.forEach(([label, val]) => {
    doc.font("Helvetica").fontSize(9).fillColor(GRAY_500).text(label, labelX, dy, { width: labelW, align: "right" });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GRAY_900).text(val, valX, dy, { width: valW, align: "right" });
    dy += 17;
  });

  // ── Tabla de artículos ─────────────────────────────────────────────
  let tableY = Math.max(clientY, dy) + 22;
  const colNum = { x: ML, w: 26 };
  const colDesc = { x: ML + 26, w: 274 };
  const colQty = { x: ML + 300, w: 55 };
  const colRate = { x: ML + 355, w: 70 };
  const colAmt = { x: ML + 425, w: MR - (ML + 425) };

  doc.rect(ML, tableY, CW, 22).fill(HEADER_BG);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
  doc.text("#", colNum.x + 6, tableY + 7);
  doc.text("Artículo y descripción", colDesc.x, tableY + 7, { width: colDesc.w });
  doc.text("Cant.", colQty.x, tableY + 7, { width: colQty.w, align: "right" });
  doc.text("Tarifa", colRate.x, tableY + 7, { width: colRate.w, align: "right" });
  doc.text("Importe", colAmt.x, tableY + 7, { width: colAmt.w - 6, align: "right" });

  let rowY = tableY + 22;
  let subtotal = 0;
  items.forEach((it, idx) => {
    const cantidad = Number(it.cantidad) || 0;
    const precio = Number(it.precio) || 0;
    const amount = cantidad * precio;
    subtotal += amount;

    const descHeight = doc.font("Helvetica").fontSize(9).heightOfString(it.descripcion || "", { width: colDesc.w });
    const rowH = Math.max(22, descHeight + 10);

    doc.font("Helvetica").fontSize(9).fillColor(GRAY_900);
    doc.text(String(idx + 1), colNum.x + 6, rowY + 6);
    doc.text(it.descripcion || "", colDesc.x, rowY + 6, { width: colDesc.w });
    doc.text(num(cantidad), colQty.x, rowY + 6, { width: colQty.w, align: "right" });
    doc.text(money(precio), colRate.x, rowY + 6, { width: colRate.w, align: "right" });
    doc.text(money(amount), colAmt.x, rowY + 6, { width: colAmt.w - 6, align: "right" });

    doc.moveTo(ML, rowY + rowH).lineTo(MR, rowY + rowH).strokeColor(GRAY_200).lineWidth(0.5).stroke();
    rowY += rowH;
  });

  // ── Totales ─────────────────────────────────────────────────────────
  const total = subtotal;
  const pagado = Number(invoice.pagado) || 0;
  const saldo = total - pagado;

  let totalsY = rowY + 16;
  const tLabelW = 130, tValW = 100;
  const tLabelX = MR - tLabelW - tValW, tValX = MR - tValW;

  const totalLine = (label, val, opts = {}) => {
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size || 9)
      .fillColor(opts.color || GRAY_500).text(label, tLabelX, totalsY, { width: tLabelW, align: "right" });
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size || 9)
      .fillColor(opts.valColor || GRAY_900).text(val, tValX, totalsY, { width: tValW, align: "right" });
    totalsY += opts.gap || 18;
  };

  totalLine("Subtotal", money(subtotal));
  totalLine("Total", money(total), { bold: true, size: 10, color: GRAY_900 });
  if (pagado > 0) {
    totalLine("Pago realizado (-)", money(pagado), { valColor: "#dc2626" });
  }

  doc.rect(tLabelX - 12, totalsY - 4, tLabelW + tValW + 12, 26).fill("#f3f4f6");
  doc.font("Helvetica-Bold").fontSize(10).fillColor(GRAY_900)
    .text("Saldo adeudado", tLabelX, totalsY + 4, { width: tLabelW, align: "right" });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(GRAY_900)
    .text(money(saldo), tValX, totalsY + 4, { width: tValW, align: "right" });
  totalsY += 34;

  // ── Notas ───────────────────────────────────────────────────────────
  if (invoice.notas) {
    doc.font("Helvetica").fontSize(9).fillColor(GRAY_500).text("Notas", ML, totalsY);
    doc.font("Helvetica").fontSize(9).fillColor(GRAY_700)
      .text(invoice.notas, ML, totalsY + 14, { width: 320 });
  }

  // ── Pie de página ───────────────────────────────────────────────────
  const footerY = 760;
  doc.font("Helvetica").fontSize(8).fillColor(GRAY_400)
    .text("Creado con ProfitCod", ML, footerY, { width: 200, lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(GRAY_400)
    .text("1", ML, footerY, { width: CW, align: "right", lineBreak: false });

  doc.end();
}

module.exports = { renderPFacturaPDF };
