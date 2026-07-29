import type { PaymentGatewayHandler } from "./types";

// Stub — proves the PaymentGatewayHandler abstraction is provider-agnostic
// (Handbook 10.3) without needing a Flutterwave account today. Wire this up
// exactly like paystack.gateway.ts (HMAC verification per Flutterwave's own
// `verif-hash` header scheme, `/charges` initialize endpoint) once it's
// prioritized — deferred per the Phase 2 plan's scope decision, not because
// the interface can't support it.
export const flutterwaveGateway: PaymentGatewayHandler = {
  processor: "flutterwave",

  async initializePayment() {
    throw new Error(
      "Flutterwave is not yet configured — Paystack is the primary processor for Phase 2",
    );
  },

  verifyWebhookSignature() {
    return false;
  },

  parseWebhookEvent() {
    return null;
  },
};
