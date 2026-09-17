import { createHmac, timingSafeEqual } from "node:crypto";
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
 * account (free, sandbox — see the Phase 2 plan's external-account note).
 * secretKey is resolved by the caller (payment-credential.service.ts) —
 * an org's own connected Paystack key if they've bring-your-own-connected
 * one, Vela's own platform PAYSTACK_SECRET_KEY otherwise; either way, a
 * missing/unresolved key fails loudly at the call site, never at boot
 * (Handbook 1.4).
 */
export const paystackGateway: PaymentGatewayHandler = {
  processor: "paystack",

  async initializePayment(
    input: InitializePaymentInput,
    secretKey: string,
  ): Promise<InitializePaymentResult> {
    const res = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
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

  peekReference(rawBody: Buffer): string | null {
    try {
      const parsed = JSON.parse(rawBody.toString("utf8")) as { data?: { reference?: string } };
      return parsed.data?.reference ?? null;
    } catch {
      return null;
    }
  },

  verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    secretKey: string,
  ): boolean {
    if (!signatureHeader || !secretKey) return false;
    const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
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
