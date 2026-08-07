import { renderEmailLayout, type EmailContent } from "./layout";

// Sent immediately on waitlist join (nurture-email.job.ts) — segment comes
// from waitlist.service.ts#deriveSegment, never trusted from the client.
export function nurtureDay0Email(
  segment: "tier_0" | "mid_market",
  ownerName: string,
): EmailContent {
  if (segment === "tier_0") {
    const subject = "Welcome to Vela — know what's in the till before you count it";
    const bodyHtml = `
      <p>Hi ${ownerName},</p>
      <p>You're on the list. Vela's Quick Sale and cash reconciliation tools are built for
      businesses that take walk-in payments all day and need to know, at a glance, whether the
      cash in the drawer actually matches what was sold.</p>
      <p>We'll email you again in a few days with more on how that works. No spam — just this
      short sequence.</p>
      <p>— The Vela team</p>`;
    const text = `Hi ${ownerName},\n\nYou're on the list. Vela's Quick Sale and cash reconciliation tools are built for businesses that take walk-in payments all day and need to know, at a glance, whether the cash in the drawer actually matches what was sold.\n\nWe'll email you again in a few days with more on how that works. No spam — just this short sequence.\n\n— The Vela team`;
    return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
  }

  const subject = "Welcome to Vela — get paid on time, without the follow-up calls";
  const bodyHtml = `
    <p>Hi ${ownerName},</p>
    <p>You're on the list. Vela's SmartInvoice sends professional invoices, chases late
    payments automatically, and shows you exactly which clients are becoming a risk before
    an invoice goes overdue.</p>
    <p>We'll email you again in a few days with more on how that works. No spam — just this
    short sequence.</p>
    <p>— The Vela team</p>`;
  const text = `Hi ${ownerName},\n\nYou're on the list. Vela's SmartInvoice sends professional invoices, chases late payments automatically, and shows you exactly which clients are becoming a risk before an invoice goes overdue.\n\nWe'll email you again in a few days with more on how that works. No spam — just this short sequence.\n\n— The Vela team`;
  return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
}
