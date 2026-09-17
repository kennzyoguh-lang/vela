import { renderEmailLayout, type EmailContent } from "./layout";
import type { TransactionCategory } from "@prisma/client";

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function categoryLabel(category: TransactionCategory): string {
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Automated accountant reports (F-connectors-adjacent) — a monthly,
// no-login-required summary of one client org's books, delivered
// automatically (accountant-report.job.ts) so an accountant never has to
// remember to open the portal to see whether anything needs their
// attention. Every figure here is also reachable live in the accountant
// portal (accountant-portal.service.ts#getClientOrgSummary) — this is a
// push of the same picture, not a second source of truth.
export function accountantMonthlyReportEmail(params: {
  orgName: string;
  month: string; // "YYYY-MM"
  currency: string;
  income: number;
  expensesByCategory: Partial<Record<TransactionCategory, number>>;
  netProfit: number;
  outstandingInvoicesTotal: number;
  outstandingInvoicesCount: number;
  nextComplianceFilingLabel: string | null;
  nextComplianceFilingDueDate: Date | null;
}): EmailContent {
  const monthName = new Date(`${params.month}-01T00:00:00Z`).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const subject = `${params.orgName}'s ${monthName} summary`;

  const expenseRows = Object.entries(params.expensesByCategory)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .map(
      ([category, amount]) =>
        `<tr><td style="padding:4px 0;">${categoryLabel(category as TransactionCategory)}</td><td style="padding:4px 0;text-align:right;">${formatMoney(amount ?? 0, params.currency)}</td></tr>`,
    )
    .join("");

  const compliancePhrase = params.nextComplianceFilingLabel
    ? `Next compliance filing: <strong>${params.nextComplianceFilingLabel}</strong>, due ${params.nextComplianceFilingDueDate?.toLocaleDateString("en-NG")}.`
    : "No compliance filings currently outstanding.";

  const bodyHtml = `
    <p>Here's ${params.orgName}'s summary for ${monthName}.</p>
    <table role="presentation" width="100%" style="margin-top:16px;">
      <tr><td style="padding:4px 0;">Income</td><td style="padding:4px 0;text-align:right;">${formatMoney(params.income, params.currency)}</td></tr>
      ${expenseRows}
      <tr><td style="padding:8px 0 4px;border-top:1px solid #e0e0e0;font-weight:bold;">Net profit</td><td style="padding:8px 0 4px;border-top:1px solid #e0e0e0;text-align:right;font-weight:bold;">${formatMoney(params.netProfit, params.currency)}</td></tr>
    </table>
    <p style="margin-top:20px;">Outstanding invoices: <strong>${params.outstandingInvoicesCount}</strong> totalling <strong>${formatMoney(params.outstandingInvoicesTotal, params.currency)}</strong>.</p>
    <p>${compliancePhrase}</p>
    <p style="margin-top:20px;font-size:13px;">Full detail, including every transaction, is available any time in your Vela accountant portal.</p>`;

  const expenseLines = Object.entries(params.expensesByCategory)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .map(
      ([category, amount]) =>
        `${categoryLabel(category as TransactionCategory)}: ${formatMoney(amount ?? 0, params.currency)}`,
    )
    .join("\n");

  const text = [
    `${params.orgName}'s summary for ${monthName}`,
    "",
    `Income: ${formatMoney(params.income, params.currency)}`,
    expenseLines,
    `Net profit: ${formatMoney(params.netProfit, params.currency)}`,
    "",
    `Outstanding invoices: ${params.outstandingInvoicesCount} totalling ${formatMoney(params.outstandingInvoicesTotal, params.currency)}`,
    params.nextComplianceFilingLabel
      ? `Next compliance filing: ${params.nextComplianceFilingLabel}, due ${params.nextComplianceFilingDueDate?.toLocaleDateString("en-NG")}`
      : "No compliance filings currently outstanding.",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
}
