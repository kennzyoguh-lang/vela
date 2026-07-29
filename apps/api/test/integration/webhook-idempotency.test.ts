// Handbook 5.9: a webhook can be delivered more than once for the same event
// (retries on a slow/failed 200) — replaying the same event ID must mark an
// invoice paid exactly once and never create a second TransactionMarkup row.
// Runs against the real Supabase database, same as cross-tenant-isolation.test.ts.
import { randomUUID, createHmac } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const PAYSTACK_TEST_SECRET = "sk_test_webhook_idempotency_fixture";

beforeAll(() => {
  process.env.PAYSTACK_SECRET_KEY = PAYSTACK_TEST_SECRET;
});

function signBody(body: string): string {
  return createHmac("sha512", PAYSTACK_TEST_SECRET).update(body).digest("hex");
}

describe("webhook idempotency (Paystack charge.success)", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  // Several sequential round-trips to the (cross-region) Supabase pooler, run
  // concurrently with the other integration file's own DB traffic — the
  // default 15s budget is occasionally too tight for that combination.
  it("processes the first delivery, marks the invoice paid, and ignores a byte-identical replay", async () => {
    const { withOrgScope } = await import("../../src/lib/prisma");
    const invoiceRepo = await import("../../src/repositories/invoice.repository");
    const invoiceService = await import("../../src/services/invoice.service");
    const { processWebhook } = await import("../../src/services/payment-webhook.service");

    const orgId = randomUUID();
    await withOrgScope(orgId, (tx) =>
      tx.organisation.create({ data: { id: orgId, name: "Webhook Test Org", country: "NG" } }),
    );
    createdOrgIds.push(orgId);

    const client = await withOrgScope(orgId, (tx) =>
      tx.client.create({
        data: { id: randomUUID(), orgId, name: "Webhook Test Client", paymentTerms: 14 },
      }),
    );

    const invoice = await invoiceRepo.createInvoice(orgId, {
      clientId: client.id,
      lineItems: [{ description: "Services rendered", quantity: 1, unitPrice: 50000 }],
      subtotal: 50000,
      tax: 0,
      discount: 0,
      total: 50000,
      currency: "NGN",
      dueDate: new Date("2026-08-01"),
    });
    // The payment portal link is only ever shared once an invoice is Sent
    // (Design System 6.13) — a webhook arriving for a still-Draft invoice
    // isn't a realistic delivery to simulate.
    await invoiceService.sendInvoice(orgId, invoice.id);

    const eventId = Math.floor(Math.random() * 1_000_000_000);
    const rawBody = Buffer.from(
      JSON.stringify({
        event: "charge.success",
        data: {
          id: eventId,
          reference: invoice.paymentPortalToken,
          amount: 5_000_000, // kobo => ₦50,000.00
          fees: 75_000, // kobo => ₦750.00
          currency: "ngn",
          paid_at: "2026-07-20T10:00:00.000Z",
          status: "success",
        },
      }),
    );
    const signature = signBody(rawBody.toString());

    const firstOutcome = await processWebhook("paystack", rawBody, signature);
    expect(firstOutcome).toBe("processed");

    const afterFirst = await invoiceRepo.findById(orgId, invoice.id);
    expect(afterFirst?.status).toBe("paid");

    const secondOutcome = await processWebhook("paystack", rawBody, signature);
    expect(secondOutcome).toBe("duplicate");

    // Reading markups directly (no listByInvoice helper exists yet) — exactly
    // one row must exist regardless of how many times the event was replayed.
    const markups = await withOrgScope(orgId, (tx) =>
      tx.transactionMarkup.findMany({ where: { orgId, invoiceId: invoice.id } }),
    );
    expect(markups).toHaveLength(1);
    expect(markups[0]?.velaFeeAmount.toString()).toBe("500");
  }, 30_000);

  it("rejects a webhook whose signature doesn't match, before ever touching the invoice", async () => {
    const { processWebhook } = await import("../../src/services/payment-webhook.service");
    const rawBody = Buffer.from(
      JSON.stringify({ event: "charge.success", data: { id: 999, reference: "does-not-matter" } }),
    );
    const wrongSignature = createHmac("sha512", "wrong-secret").update(rawBody).digest("hex");

    const outcome = await processWebhook("paystack", rawBody, wrongSignature);

    expect(outcome).toBe("invalid_signature");
  });
});
