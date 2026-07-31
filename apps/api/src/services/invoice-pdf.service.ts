import PDFDocument from "pdfkit";
import type { Invoice, Client, Organisation } from "@prisma/client";
import type { LineItem } from "../validation/invoice.schema";
import { drawVelaMark } from "../lib/vela-mark-pdf";

const MIDNIGHT = "#0D1B2A";
const GOLD = "#C9A84C";
const TEXT_SECONDARY = "#55677E";

// Prisma's Decimal columns (subtotal/tax/discount/total) come back as a
// Decimal instance, not a plain number — accepting anything stringifiable
// avoids scattering .toString()/.toNumber() calls at every call site.
function formatMoney(value: number | string | { toString(): string }, currency: string): string {
  const amount = typeof value === "number" ? value : parseFloat(value.toString());
  return `${currency} ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Renders the branded invoice PDF (Design System 2.3's token-derived palette;
 * standard PDF fonts stand in for the exact brand typefaces — Times-Roman for
 * Display/Palatino, Helvetica for UI/Inter, Courier-Bold for Data/Courier New
 * Bold — until custom font embedding is worth the added complexity).
 */
export function renderInvoicePdf(
  invoice: Invoice,
  // Nullable — a Quick Sale invoice has no client at all (see schema.prisma's
  // InvoiceSource comment).
  client: Client | null,
  organisation: Organisation,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const lineItems = invoice.lineItems as unknown as LineItem[];

  // Header band
  doc.rect(0, 0, doc.page.width, 90).fill(MIDNIGHT);
  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(organisation.name, 50, 30, { characterSpacing: 1 });
  doc
    .fillColor(GOLD)
    .font("Helvetica")
    .fontSize(10)
    .text("INVOICE", 50, 58, { characterSpacing: 3 });

  doc.fillColor(MIDNIGHT).font("Courier-Bold").fontSize(14).text(invoice.number, 0, 35, {
    align: "right",
  });

  doc.moveDown(4);
  doc.y = 120;

  // Bill-to / meta
  doc.font("Helvetica-Bold").fontSize(11).fillColor(MIDNIGHT).text("Bill to", 50, 120);
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_SECONDARY);
  if (client) {
    doc.text(client.name, 50, 136);
    if (client.email) doc.text(client.email, 50, 150);
    if (client.address) doc.text(client.address, 50, 164);
  } else {
    doc.text("Walk-in customer", 50, 136);
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor(MIDNIGHT).text("Due date", 350, 120);
  doc
    .font("Courier-Bold")
    .fontSize(10)
    .fillColor(TEXT_SECONDARY)
    .text(invoice.dueDate.toISOString().slice(0, 10), 350, 136);

  // Line items table
  let y = 210;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MIDNIGHT);
  doc.text("Description", 50, y);
  doc.text("Qty", 320, y, { width: 50, align: "right" });
  doc.text("Unit Price", 380, y, { width: 80, align: "right" });
  doc.text("Amount", 470, y, { width: 80, align: "right" });
  y += 16;
  doc.moveTo(50, y).lineTo(550, y).strokeColor(MIDNIGHT).stroke();
  y += 8;

  doc.font("Helvetica").fontSize(9).fillColor(MIDNIGHT);
  for (const item of lineItems) {
    doc.text(item.description, 50, y, { width: 260 });
    doc.font("Courier").text(String(item.quantity), 320, y, { width: 50, align: "right" });
    doc.text(formatMoney(item.unitPrice, invoice.currency), 380, y, { width: 80, align: "right" });
    doc.text(formatMoney(item.quantity * item.unitPrice, invoice.currency), 470, y, {
      width: 80,
      align: "right",
    });
    doc.font("Helvetica");
    y += 18;
  }

  y += 10;
  doc.moveTo(320, y).lineTo(550, y).strokeColor(TEXT_SECONDARY).stroke();
  y += 10;

  const totalsRow = (label: string, value: string, bold = false) => {
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor(MIDNIGHT);
    doc.text(label, 380, y, { width: 80, align: "right" });
    doc.font("Courier-Bold").fontSize(bold ? 12 : 9);
    doc.text(value, 470, y, { width: 80, align: "right" });
    y += bold ? 20 : 16;
  };

  totalsRow("Subtotal", formatMoney(invoice.subtotal, invoice.currency));
  totalsRow("Tax", formatMoney(invoice.tax, invoice.currency));
  totalsRow("Discount", `-${formatMoney(invoice.discount, invoice.currency)}`);
  totalsRow("Total", formatMoney(invoice.total, invoice.currency), true);

  if (invoice.notes) {
    y += 20;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MIDNIGHT).text("Notes", 50, y);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(TEXT_SECONDARY)
      .text(invoice.notes, 50, y + 14, { width: 500 });
  }

  // Logo Identity System §07: "never the wordmark alone without the mark" —
  // the footer used to be bare text; the mark now sits beside it, sized and
  // manually centered as one block (PDFKit can't center an icon+text run
  // with a single .text() call the way flexbox would).
  const footerText = "Powered by VELA";
  const footerMarkSize = 10;
  const footerGap = 5;
  doc.font("Helvetica").fontSize(8);
  const footerTextWidth = doc.widthOfString(footerText);
  const footerBlockWidth = footerMarkSize + footerGap + footerTextWidth;
  const footerBlockX = 50 + (500 - footerBlockWidth) / 2;
  // A few points of headroom above the bottom margin — sitting exactly on it
  // (the old bare-text footer did) risks PDFKit deciding the line overflows
  // and silently starting a fresh page for it.
  const footerY = doc.page.height - doc.page.margins.bottom - 15;
  drawVelaMark(doc, footerBlockX, footerY - 1, footerMarkSize, "mono-dark");
  doc
    .fillColor(TEXT_SECONDARY)
    .text(footerText, footerBlockX + footerMarkSize + footerGap, footerY);

  return doc;
}
