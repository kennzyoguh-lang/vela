import { env } from "../../lib/env";
import { renderEmailLayout, type EmailContent } from "./layout";

// Sent once, right after signup (auth.service.ts#signup) — never blocks
// issuing the session itself (see that function's comment); this is a
// best-effort side email, not a gate.
export function verifyEmailEmail(ownerName: string, token: string): EmailContent {
  const verifyUrl = `${env.WEB_APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Confirm your email for VELA";
  const bodyHtml = `
    <p>Hi ${ownerName},</p>
    <p>One last step — confirm this is really your email address so we can reach you about
    your account.</p>
    <p style="margin-top:24px;"><a href="${verifyUrl}" style="background-color:#C9A84C;color:#0D1B2A;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">Confirm my email</a></p>
    <p style="margin-top:16px;font-size:13px;">This link expires in 24 hours. If you didn't create a VELA account, you can ignore this email.</p>`;
  const text = `Hi ${ownerName},\n\nOne last step — confirm this is really your email address so we can reach you about your account.\n\nConfirm my email: ${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create a VELA account, you can ignore this email.`;
  return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
}
