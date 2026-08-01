import { env } from "../../lib/env";
import { logger } from "../../lib/logger";

const TERMII_API_BASE = "https://api.ng.termii.com/api";

interface TermiiSendResponse {
  code?: string;
  message?: string;
  message_id?: string;
}

// Termii's /sms/send endpoint is also how WhatsApp goes out — "channel" is
// the field that picks the transport, there's no separate WhatsApp endpoint.
// "generic" is plain SMS; "whatsapp" requires the account's WhatsApp sender
// to be approved on Termii's side, same account-setup caveat as
// TERMII_SENDER_ID needing registration for production SMS.
export type TermiiChannel = "generic" | "whatsapp";

/**
 * Termii (Nigerian SMS/WhatsApp provider) — same "optional, fails loudly at
 * the call site, never blocks app boot" contract as Paystack/Mono/Anthropic
 * (Handbook 1.4, see lib/env.ts). Unset TERMII_API_KEY means every caller
 * gets the same honest "[stub] would send" log this codebase already used
 * before a real provider was wired up, never a crash.
 *
 * Deliberately throws on a genuine send failure once a key IS configured —
 * callers that need the trader to know whether it actually worked (Quick
 * Sale's "Send SMS/WhatsApp" button) let this propagate; callers attached to
 * an unrelated primary action (submitting a cash check, the daily summary
 * job) catch it themselves so a bad number or provider outage never blocks
 * that primary action.
 */
export async function sendSms(
  to: string,
  message: string,
  channel: TermiiChannel = "generic",
): Promise<void> {
  if (!env.TERMII_API_KEY) {
    logger.info(
      { to, message, channel },
      `[stub] would send ${channel === "whatsapp" ? "WhatsApp message" : "SMS"} via Termii — TERMII_API_KEY not configured`,
    );
    return;
  }

  const res = await fetch(`${TERMII_API_BASE}/sms/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: env.TERMII_API_KEY,
      to,
      from: env.TERMII_SENDER_ID,
      sms: message,
      type: "plain",
      channel,
    }),
  });

  const body = (await res.json()) as TermiiSendResponse;
  if (!res.ok || body.code !== "ok") {
    throw new Error(
      `Termii ${channel === "whatsapp" ? "WhatsApp" : "SMS"} send failed: ${body.message ?? res.statusText}`,
    );
  }
}
