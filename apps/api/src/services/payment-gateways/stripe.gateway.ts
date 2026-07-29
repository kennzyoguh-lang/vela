import type { PaymentGatewayHandler } from "./types";

// Stub — see flutterwave.gateway.ts's note. Stripe's real implementation
// would use payment_intent.succeeded webhooks and the Stripe SDK's own
// signature verification (Stripe-Signature header, timestamped HMAC).
export const stripeGateway: PaymentGatewayHandler = {
  processor: "stripe",

  async initializePayment() {
    throw new Error("Stripe is not yet configured — Paystack is the primary processor for Phase 2");
  },

  verifyWebhookSignature() {
    return false;
  },

  parseWebhookEvent() {
    return null;
  },
};
