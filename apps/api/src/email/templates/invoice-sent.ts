import { renderEmailLayout, type EmailContent } from "./layout";

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

// F-02/F-56 — sent when an invoice transitions to "sent" (invoice.service.ts
// #sendInvoice). This is the SME's customer's copy, not an internal
// notification, so it gets the fuller branded treatment verify-email.ts
// established rather than owner-summary's plain-text style.
export function invoiceSentEmail(params: {
  clientName: string;
  orgName: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  dueDate: Date;
  payUrl: string;
}): EmailContent {
  const amount = formatMoney(params.total, params.currency);
  const due = formatDate(params.dueDate);
  const subject = `Invoice ${params.invoiceNumber} from ${params.orgName} — ${amount}`;
  const bodyHtml = `
    <p>Hi ${params.clientName},</p>
    <p>${params.orgName} sent you invoice <strong>${params.invoiceNumber}</strong> for
    <strong>${amount}</strong>, due ${due}.</p>
    <p style="margin-top:24px;"><a href="${params.payUrl}" style="background-color:#C9A84C;color:#0D1B2A;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; pay invoice</a></p>
    <p style="margin-top:16px;font-size:13px;">No account or app needed — the link opens straight to a secure payment page.</p>`;
  const text = `Hi ${params.clientName},\n\n${params.orgName} sent you invoice ${params.invoiceNumber} for ${amount}, due ${due}.\n\nView & pay: ${params.payUrl}\n\nNo account or app needed — the link opens straight to a secure payment page.`;
  return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
}
