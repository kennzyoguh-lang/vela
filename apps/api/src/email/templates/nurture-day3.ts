import { renderEmailLayout, type EmailContent } from "./layout";

export function nurtureDay3Email(
  segment: "tier_0" | "mid_market",
  ownerName: string,
): EmailContent {
  if (segment === "tier_0") {
    const subject = "The gap between 'sales' and 'cash in hand'";
    const bodyHtml = `
      <p>Hi ${ownerName},</p>
      <p>Most walk-in businesses only find out something's wrong at the end of the day, when
      the cash doesn't match — and by then it's too late to say why. Vela's cash
      reconciliation compares every logged sale against what's actually counted, the moment
      you count it, so a shortfall gets flagged the same day, not weeks later.</p>
      <p>— The Vela team</p>`;
    const text = `Hi ${ownerName},\n\nMost walk-in businesses only find out something's wrong at the end of the day, when the cash doesn't match — and by then it's too late to say why. Vela's cash reconciliation compares every logged sale against what's actually counted, the moment you count it, so a shortfall gets flagged the same day, not weeks later.\n\n— The Vela team`;
    return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
  }

  const subject = "What a 15-day-late invoice actually costs you";
  const bodyHtml = `
    <p>Hi ${ownerName},</p>
    <p>A late invoice isn't just annoying — it's a cash-flow gap you're financing out of your
    own pocket. Vela scores every invoice's risk of going overdue and sends automatic
    reminders before it happens, so chasing payment stops being your job.</p>
    <p>— The Vela team</p>`;
  const text = `Hi ${ownerName},\n\nA late invoice isn't just annoying — it's a cash-flow gap you're financing out of your own pocket. Vela scores every invoice's risk of going overdue and sends automatic reminders before it happens, so chasing payment stops being your job.\n\n— The Vela team`;
  return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
}
