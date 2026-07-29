import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../lib/env";
import type {
  PaymentGatewayHandler,
  InitializePaymentInput,
  InitializePaymentResult,
  VerifiedPaymentEvent,
} from "./types";

const PAYSTACK_API_BASE = "https://api.paystack.co";

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: { authorization_url: string; access_code: string; reference: string };
}

interface PaystackChargeEvent {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number; // kobo
    fees: number | null; // kobo
    currency: string;
    paid_at: string;
    status: string;
  };
}

/**
 * BRD v3.1's primary Nigerian processor. Test-mode requires a Paystack
 * account (free, sandbox — see the Phase 2 plan's external-account note);
 * PAYSTACK_SECRET_KEY unset means initializePayment fails loudly at the call
 * site, not at boot (Handbook 1.4 — a missing payment key must never block
 * anything else in the app).
 */
export const paystackGateway: PaymentGatewayHandler = {
  processor: "paystack",

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    if (!env.PAYSTACK_SECRET_KEY) {
      throw new Error(
        "PAYSTACK_SECRET_KEY is not configured — create a Paystack account and set the test secret key to enable payments",
      );
    }

    const res = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.payerEmail,
        amount: Math.round(input.amount * 100), // Paystack expects the smallest currency unit (kobo)
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
      }),
    });

    const body = (await res.json()) as PaystackInitializeResponse;
    if (!res.ok || !body.status || !body.data) {
      throw new Error(`Paystack initialize failed: ${body.message ?? res.statusText}`);
    }

    return { checkoutUrl: body.data.authorization_url, providerReference: body.data.reference };
  },

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader || !env.PAYSTACK_SECRET_KEY) return false;
    const expected = createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
    // Constant-time comparison — a signature check that short-circuits on the
    // first differing byte leaks timing information an attacker can exploit.
    const expectedBuf = Buffer.from(expected, "hex");
    const givenBuf = Buffer.from(signatureHeader, "hex");
    if (expectedBuf.length !== givenBuf.length) return false;
    return timingSafeEqual(expectedBuf, givenBuf);
  },

  parseWebhookEvent(rawBody: Buffer): VerifiedPaymentEvent | null {
    const parsed = JSON.parse(rawBody.toString("utf8")) as PaystackChargeEvent;
    if (parsed.event !== "charge.success") return null;

    return {
      eventId: String(parsed.data.id),
      reference: parsed.data.reference,
      status: "success",
      grossAmount: parsed.data.amount / 100,
      currency: parsed.data.currency.toUpperCase(),
      processorFee: (parsed.data.fees ?? 0) / 100,
      paidAt: new Date(parsed.data.paid_at),
    };
  },
};
