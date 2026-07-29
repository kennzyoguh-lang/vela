import { createHmac } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";

const TEST_SECRET = "sk_test_fixture_secret_not_real";

beforeAll(() => {
  process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
});

function signBody(body: string): string {
  return createHmac("sha512", TEST_SECRET).update(body).digest("hex");
}

describe("paystackGateway", () => {
  it("verifies a correctly-signed webhook body", async () => {
    const { paystackGateway } = await import("./paystack.gateway");
    const rawBody = Buffer.from(JSON.stringify({ event: "charge.success", data: {} }));
    const signature = signBody(rawBody.toString());
    expect(paystackGateway.verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it("rejects a webhook signed with the wrong secret", async () => {
    const { paystackGateway } = await import("./paystack.gateway");
    const rawBody = Buffer.from(JSON.stringify({ event: "charge.success", data: {} }));
    const wrongSignature = createHmac("sha512", "wrong-secret").update(rawBody).digest("hex");
    expect(paystackGateway.verifyWebhookSignature(rawBody, wrongSignature)).toBe(false);
  });

  it("rejects a webhook with a tampered body (signature no longer matches)", async () => {
    const { paystackGateway } = await import("./paystack.gateway");
    const originalBody = JSON.stringify({ event: "charge.success", data: { amount: 1000 } });
    const signature = signBody(originalBody);
    const tamperedBody = Buffer.from(
      JSON.stringify({ event: "charge.success", data: { amount: 999999 } }),
    );
    expect(paystackGateway.verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });

  it("rejects when no signature header is present", async () => {
    const { paystackGateway } = await import("./paystack.gateway");
    const rawBody = Buffer.from(JSON.stringify({ event: "charge.success", data: {} }));
    expect(paystackGateway.verifyWebhookSignature(rawBody, undefined)).toBe(false);
  });

  it("parses a charge.success event into a VerifiedPaymentEvent", async () => {
    const { paystackGateway } = await import("./paystack.gateway");
    const rawBody = Buffer.from(
      JSON.stringify({
        event: "charge.success",
        data: {
          id: 987654321,
          reference: "inv-token-abc123",
          amount: 4_230_000, // kobo => ₦42,300.00
          fees: 63_450, // kobo => ₦634.50
          currency: "ngn",
          paid_at: "2026-06-15T10:30:00.000Z",
          status: "success",
        },
      }),
    );
    const event = paystackGateway.parseWebhookEvent(rawBody);
    expect(event).toEqual({
      eventId: "987654321",
      reference: "inv-token-abc123",
      status: "success",
      grossAmount: 42_300,
      currency: "NGN",
      processorFee: 634.5,
      paidAt: new Date("2026-06-15T10:30:00.000Z"),
    });
  });

  it("returns null for event types it doesn't act on", async () => {
    const { paystackGateway } = await import("./paystack.gateway");
    const rawBody = Buffer.from(JSON.stringify({ event: "transfer.success", data: {} }));
    expect(paystackGateway.parseWebhookEvent(rawBody)).toBeNull();
  });
});
