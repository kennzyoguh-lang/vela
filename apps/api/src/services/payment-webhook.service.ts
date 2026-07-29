import * as invoiceRepo from "../repositories/invoice.repository";
import * as invoiceService from "./invoice.service";
import * as transactionMarkupService from "./transaction-markup.service";
import * as webhookEventRepo from "../repositories/webhook-event.repository";
import { getGateway } from "./payment-gateways";
import { logger } from "../lib/logger";
import type { PaymentProcessor } from "@prisma/client";

/**
 * Handbook 5.9: verify signature before parsing (never trust an unverified
 * body), idempotent against replay via the provider's event ID, respond fast
 * — the caller (webhook.controller.ts) does the actual HTTP response; this
 * function is the "heavy work" that in a fuller implementation would be
 * handed to a queued job rather than run inline (Handbook 5.9's "a slow
 * handler causes retries" warning) — acceptable inline for Phase 2's scope,
 * flagged as a follow-up once webhook volume is real.
 */
export type WebhookOutcome =
  "processed" | "duplicate" | "ignored" | "unknown_invoice" | "invalid_signature";

/**
 * Only "invalid_signature" should ever produce a non-200 response (Handbook
 * 5.9) — every other outcome, including an unknown invoice reference (an
 * internal data problem, not something the sender retrying will fix), is
 * acknowledged so a misbehaving sender doesn't retry-storm an already-settled
 * situation. "invalid_signature" is the one case a genuinely malformed or
 * malicious request should not get a false "accepted" signal for.
 */
export async function processWebhook(
  processor: PaymentProcessor,
  rawBody: Buffer,
  signatureHeader: string | undefined,
): Promise<WebhookOutcome> {
  const gateway = getGateway(processor);

  if (!gateway.verifyWebhookSignature(rawBody, signatureHeader)) {
    logger.warn({ processor }, "Webhook signature verification failed — rejecting");
    return "invalid_signature";
  }

  const event = gateway.parseWebhookEvent(rawBody);
  if (!event) return "ignored"; // event type this handler doesn't act on — not an error

  const isNew = await webhookEventRepo.recordIfNew(processor, event.eventId);
  if (!isNew) {
    logger.info(
      { processor, eventId: event.eventId },
      "Duplicate webhook event — already processed",
    );
    return "duplicate";
  }

  if (event.status !== "success") return "ignored";

  // The reference IS the invoice's payment_portal_token — see invoice-portal
  // .controller.ts's initialize step, which passes it as-is to the gateway.
  const invoice = await invoiceRepo.findByPaymentPortalToken(event.reference);
  if (!invoice) {
    logger.error(
      { processor, reference: event.reference },
      "Webhook referenced an unknown invoice",
    );
    return "unknown_invoice";
  }

  await invoiceService.markPaid(invoice.orgId, invoice.id);
  await transactionMarkupService.recordMarkup({
    orgId: invoice.orgId,
    invoiceId: invoice.id,
    processor,
    grossAmount: event.grossAmount,
    processorFee: event.processorFee,
    currency: event.currency,
    settledAt: event.paidAt,
    activationChannel: "portal",
  });

  return "processed";
}
