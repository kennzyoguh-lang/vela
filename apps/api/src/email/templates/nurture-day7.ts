import { env } from "../../lib/env";
import { renderEmailLayout, type EmailContent } from "./layout";

export function nurtureDay7Email(
  segment: "tier_0" | "mid_market",
  ownerName: string,
): EmailContent {
  const signupUrl = `${env.WEB_APP_URL}/signup`;
  const ctaHtml = `<p style="margin-top:24px;"><a href="${signupUrl}" style="background-color:#C9A84C;color:#0D1B2A;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">Create your free account</a></p>`;
  const ctaText = `Create your free account: ${signupUrl}`;

  if (segment === "tier_0") {
    const subject = "See today's sales the moment they happen";
    const bodyHtml = `
      <p>Hi ${ownerName},</p>
      <p>Vela's Quick Sale logs every walk-in payment in one tap and reconciles it against the
      cash you count at the end of the day — no spreadsheets, no guessing.</p>
      ${ctaHtml}`;
    const text = `Hi ${ownerName},\n\nVela's Quick Sale logs every walk-in payment in one tap and reconciles it against the cash you count at the end of the day — no spreadsheets, no guessing.\n\n${ctaText}`;
    return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
  }

  const subject = "See which invoices are about to go overdue";
  const bodyHtml = `
    <p>Hi ${ownerName},</p>
    <p>Vela's SmartInvoice flags at-risk invoices before they're late and automatically sends
    the follow-up reminders, so you spend less time chasing and more time running the
    business.</p>
    ${ctaHtml}`;
  const text = `Hi ${ownerName},\n\nVela's SmartInvoice flags at-risk invoices before they're late and automatically sends the follow-up reminders, so you spend less time chasing and more time running the business.\n\n${ctaText}`;
  return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
}
