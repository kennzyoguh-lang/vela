import { renderEmailLayout, type EmailContent } from "./layout";

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

// F-57 — sent when a quote transitions to "sent" (quote.service.ts#sendQuote).
// Mirrors invoice-sent.ts's shape exactly; "View & pay" becomes "View &
// respond" since a quote portal collects an accept/decline, not a payment.
export function quoteSentEmail(params: {
  clientName: string;
  orgName: string;
  quoteNumber: string;
  total: number;
  currency: string;
  validUntil: Date;
  viewUrl: string;
}): EmailContent {
  const amount = formatMoney(params.total, params.currency);
  const validUntil = formatDate(params.validUntil);
  const subject = `Quote ${params.quoteNumber} from ${params.orgName} — ${amount}`;
  const bodyHtml = `
    <p>Hi ${params.clientName},</p>
    <p>${params.orgName} sent you quote <strong>${params.quoteNumber}</strong> for
    <strong>${amount}</strong>, valid until ${validUntil}.</p>
    <p style="margin-top:24px;"><a href="${params.viewUrl}" style="background-color:#C9A84C;color:#0D1B2A;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; respond</a></p>
    <p style="margin-top:16px;font-size:13px;">No account or app needed — the link opens straight to the quote.</p>`;
  const text = `Hi ${params.clientName},\n\n${params.orgName} sent you quote ${params.quoteNumber} for ${amount}, valid until ${validUntil}.\n\nView & respond: ${params.viewUrl}\n\nNo account or app needed — the link opens straight to the quote.`;
  return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
}
