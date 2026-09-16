import { env } from "../../lib/env";
import { renderEmailLayout, type EmailContent } from "./layout";

// Sent by auth.service.ts#requestPasswordReset. Mirrors verify-email.ts's
// shape; the 30-minute expiry matches jwt.service.ts's
// PASSWORD_RESET_TTL_SECONDS — stated here too so the copy never drifts out
// of sync with the actual token lifetime.
export function passwordResetEmail(name: string, token: string): EmailContent {
  const resetUrl = `${env.WEB_APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your VELA password";
  const bodyHtml = `
    <p>Hi ${name},</p>
    <p>We got a request to reset your VELA password. Click below to choose a new one.</p>
    <p style="margin-top:24px;"><a href="${resetUrl}" style="background-color:#C9A84C;color:#0D1B2A;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">Reset my password</a></p>
    <p style="margin-top:16px;font-size:13px;">This link expires in 30 minutes and can only be used once. If you didn't request this, you can safely ignore this email — your password won't change.</p>`;
  const text = `Hi ${name},\n\nWe got a request to reset your VELA password. Use the link below to choose a new one.\n\nReset my password: ${resetUrl}\n\nThis link expires in 30 minutes and can only be used once. If you didn't request this, you can safely ignore this email — your password won't change.`;
  return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
}
