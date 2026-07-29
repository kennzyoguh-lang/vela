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
 */
export interface PaymentGatewayHandler {
  readonly processor: PaymentProcessor;
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  /** Verifies the webhook's signature against the RAW request body (Handbook 5.9 — never trust an unverified body). */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;
  /** Only call after verifyWebhookSignature returns true. Returns null for event types this handler doesn't act on. */
  parseWebhookEvent(rawBody: Buffer): VerifiedPaymentEvent | null;
}
