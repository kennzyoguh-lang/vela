import { env } from "../../lib/env";
import { logger } from "../../lib/logger";

const RESEND_API_BASE = "https://api.resend.com";

interface ResendSendResponse {
  id?: string;
  message?: string;
  name?: string;
}

/**
 * Resend (email provider) — same "optional, fails loudly at the call site,
 * never blocks app boot" contract as Paystack/Mono/Anthropic/Termii
 * (Handbook 1.4, see lib/env.ts). Unset RESEND_API_KEY means every caller
 * gets an honest "[stub] would send" log, never a crash — mirrors
 * termii.gateway.ts#sendSms exactly, this is its email counterpart for
 * business profiling's notification-channel default (formal/semi-formal
 * orgs route to email instead of WhatsApp/SMS).
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    logger.info(
      { to, subject, body },
      "[stub] would send email via Resend — RESEND_API_KEY not configured",
    );
    return;
  }

  const res = await fetch(`${RESEND_API_BASE}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject,
      text: body,
    }),
  });

  const responseBody = (await res.json()) as ResendSendResponse;
  if (!res.ok) {
    throw new Error(`Resend email send failed: ${responseBody.message ?? res.statusText}`);
  }
}
