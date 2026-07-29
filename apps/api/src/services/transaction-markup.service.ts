import * as transactionMarkupRepo from "../repositories/transaction-markup.repository";
import * as paymentActivationRepo from "../repositories/payment-activation.repository";
import type { PaymentProcessor } from "@prisma/client";

// BRD Section 8.1 / F-72: default 1.0%, configurable per-org later (org-level
// override isn't built yet — every org uses the platform default until a
// negotiated-rate feature exists, per the plan's scope decision).
export const DEFAULT_MARKUP_PCT = 0.01;

export interface RecordMarkupInput {
  orgId: string;
  invoiceId: string;
  processor: PaymentProcessor;
  grossAmount: number;
  processorFee: number;
  currency: string;
  settledAt: Date;
  activationChannel: string; // "whatsapp_link" | "portal" (F-71's link is the same URL as the portal)
}

/**
 * Recorded as a distinct line, never blended into the processor's own fee
 * (BRD F-72's explicit requirement) — this is Vela's primary revenue driver
 * (BRD Section 8.1), not a side calculation.
 */
export async function recordMarkup(input: RecordMarkupInput) {
  const velaFeeAmount = Math.round(input.grossAmount * DEFAULT_MARKUP_PCT * 100) / 100;

  const markup = await transactionMarkupRepo.create(input.orgId, {
    invoiceId: input.invoiceId,
    processor: input.processor,
    grossAmount: input.grossAmount,
    processorFee: input.processorFee,
    velaMarkupPct: DEFAULT_MARKUP_PCT,
    velaFeeAmount,
    currency: input.currency,
    settledAt: input.settledAt,
  });

  await paymentActivationRepo.recordPayment(
    input.orgId,
    input.activationChannel,
    input.grossAmount,
  );

  return markup;
}
