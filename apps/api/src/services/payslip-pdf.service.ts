import PDFDocument from "pdfkit";
import type { Employee, Payslip, PayrollRun, Organisation } from "@prisma/client";

const MIDNIGHT = "#0D1B2A";
const GOLD = "#C9A84C";
const TEXT_SECONDARY = "#55677E";

// Mirrors invoice-pdf.service.ts's formatMoney — Prisma Decimal columns come
// back as Decimal instances, not plain numbers.
function formatMoney(value: number | string | { toString(): string }, currency: string): string {
  const amount = typeof value === "number" ? value : parseFloat(value.toString());
  return `${currency} ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Renders the branded payslip PDF — same pdfkit/branding approach as
 * invoice-pdf.service.ts (Midnight header band, Courier for figures,
 * standard fonts standing in for the exact brand typefaces).
 */
export function renderPayslipPdf(
  payslip: Payslip,
  employee: Employee,
  run: PayrollRun,
  organisation: Organisation,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const currency = organisation.baseCurrency;

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
    .text("PAYSLIP", 50, 58, { characterSpacing: 3 });
  doc
    .fillColor(MIDNIGHT)
    .font("Courier-Bold")
    .fontSize(14)
    .text(run.periodLabel, 0, 35, { align: "right" });

  doc.y = 120;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(MIDNIGHT).text("Employee", 50, 120);
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_SECONDARY);
  doc.text(employee.name, 50, 136);
  doc.text(employee.jobTitle, 50, 150);

  let y = 200;
  const row = (label: string, value: string, bold = false) => {
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(bold ? 11 : 9)
      .fillColor(MIDNIGHT);
    doc.text(label, 50, y, { width: 300 });
    doc.font("Courier-Bold").fontSize(bold ? 12 : 9);
    doc.text(value, 380, y, { width: 170, align: "right" });
    y += bold ? 22 : 18;
  };

  row("Gross pay", formatMoney(payslip.grossPay, currency), true);
  y += 8;
  row("PAYE (tax)", `-${formatMoney(payslip.paye, currency)}`);
  row("Pension (employee 8%)", `-${formatMoney(payslip.employeePension, currency)}`);
  row("National Housing Fund", `-${formatMoney(payslip.nhf, currency)}`);
  y += 4;
  doc.moveTo(50, y).lineTo(550, y).strokeColor(TEXT_SECONDARY).stroke();
  y += 10;
  row("Net pay", formatMoney(payslip.netPay, currency), true);

  y += 20;
  doc.font("Helvetica").fontSize(8).fillColor(TEXT_SECONDARY);
  doc.text(
    `Employer pension contribution (10%, not deducted from net pay): ${formatMoney(payslip.employerPension, currency)}`,
    50,
    y,
    { width: 500 },
  );

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(TEXT_SECONDARY)
    .text("Powered by VELA", 50, doc.page.height - 50, { align: "center", width: 500 });

  return doc;
}
