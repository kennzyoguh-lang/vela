import type { PaymentProcessor } from "@prisma/client";

export interface InitializePaymentInput {
  reference: string; // our own reference, tied 1:1 to the invoice
  amount: number; // major currency unit (e.g. Naira, not kobo) — handlers convert internally
  currency: string;
  payerEmail: string;
  callbackUrl: string;
}

export interface InitializePaymentResult {
  checkoutUrl: string;
  providerReference: string;
}

export interface VerifiedPaymentEvent {
  eventId: string; // idempotency key (Handbook 5.9) — unique per provider
  reference: string; // our reference, to look the invoice back up
  status: "success" | "failed";
  grossAmount: number;
  currency: string;
  processorFee: number;
  paidAt: Date;
}

/**
 * Handbook 10.3: Stripe and Flutterwave webhook handlers share this
 * abstraction with Paystack so invoice-status-update logic isn't duplicated
 * per provider — only signature verification and payload parsing differ.
 *
 * secretKey is always resolved by the caller (payment-credential.service.ts
 * — an org's own connected credential if present, Vela's own platform env
 * key otherwise) and passed in explicitly, rather than each handler reading
 * its platform env var directly. This is what makes bring-your-own-processor
 * (F-connectors) possible: a handler has no way to know, on its own, which
 * org's key it should be signing/verifying with.
 */
export interface PaymentGatewayHandler {
  readonly processor: PaymentProcessor;
  initializePayment(
    input: InitializePaymentInput,
    secretKey: string,
  ): Promise<InitializePaymentResult>;
  /**
   * Reads ONLY the reference field, making no other use of the body's
   * contents — this runs BEFORE signature verification, purely to look up
   * which org's key to verify against (payment-webhook.service.ts). Every
   * other field (amount, status, ...) still only becomes trusted data once
   * verifyWebhookSignature has passed; this is not an exception to Handbook
   * 5.9, it's what makes checking the right key possible at all in a
   * multi-tenant, bring-your-own-key world. Returns null if the body is
   * malformed or has no reference field.
   */
  peekReference(rawBody: Buffer): string | null;
  /** Verifies the webhook's signature against the RAW request body (Handbook 5.9 — never trust an unverified body) using the resolved secretKey. */
  verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    secretKey: string,
  ): boolean;
  /** Only call after verifyWebhookSignature returns true. Returns null for event types this handler doesn't act on. */
  parseWebhookEvent(rawBody: Buffer): VerifiedPaymentEvent | null;
}
