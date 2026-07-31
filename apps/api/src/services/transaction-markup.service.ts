import * as transactionMarkupRepo from "../repositories/transaction-markup.repository";
import * as paymentActivationRepo from "../repositories/payment-activation.repository";
import type { PaymentProcessor } from "@prisma/client";

// BRD Section 8.1 / F-72: default 1.0%, configurable per-org later (org-level
// override isn't built yet — every org uses the platform default until a
// negotiated-rate feature exists, per the plan's scope decision).
export const DEFAULT_MARKUP_PCT = 0.01;

// A flat 1% grows unbounded with transaction size — a ₦500,000 payment costs
// ₦5,000 in fees, which is exactly the visible number that pushes a large
// transaction back to a free bank transfer instead. Capping the absolute
// fee (not the rate) is the standard fix in this market — Paystack caps
// local-card fees at ₦2,000 for the same reason. This value is a business
// call, not an engineering one — flagged as easy to tune, not treated as
// final.
export const MARKUP_CAP_AMOUNT = 2000;

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
  const uncappedFee = Math.round(input.grossAmount * DEFAULT_MARKUP_PCT * 100) / 100;
  // velaMarkupPct below still records the nominal 1% rate policy (what was
  // *supposed* to apply), while velaFeeAmount is the actual amount charged
  // after the cap — the two intentionally diverge on a capped transaction,
  // same split real processors use between "rate" and "amount charged."
  const velaFeeAmount = Math.min(uncappedFee, MARKUP_CAP_AMOUNT);

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
