// Quick Sale / Instant Collect, Piece 1: fee-logic reuse verification. The
// spec's explicit requirement — "verify the 1% fee is deducted/applied
// identically whether the transaction came from an invoice payment or a
// Quick Sale payment... write this as an explicit test case" — proven here
// against the real webhook flow, unmodified, for both an uncapped and a
// capped (>= ₦200,000) amount. Mirrors webhook-idempotency.test.ts's exact
// signing/fixture pattern.
import { randomUUID, createHmac } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const PAYSTACK_TEST_SECRET = "sk_test_quick_sale_fee_parity_fixture";

beforeAll(() => {
  process.env.PAYSTACK_SECRET_KEY = PAYSTACK_TEST_SECRET;
});

function signBody(body: string): string {
  return createHmac("sha512", PAYSTACK_TEST_SECRET).update(body).digest("hex");
}

function chargeSuccessBody(eventId: number, reference: string, amountNaira: number) {
  return Buffer.from(
    JSON.stringify({
      event: "charge.success",
      data: {
        id: eventId,
        reference,
        amount: amountNaira * 100, // kobo
        fees: Math.round(amountNaira * 100 * 0.015), // arbitrary processor fee, irrelevant to Vela's own markup
        currency: "ngn",
        paid_at: "2026-07-20T10:00:00.000Z",
        status: "success",
      },
    }),
  );
}

describe("Quick Sale fee parity with manual invoice payments", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  it("an uncapped amount yields the identical 1% Vela fee for a manual invoice and a Quick Sale", async () => {
    const { withOrgScope } = await import("../../src/lib/prisma");
    const invoiceRepo = await import("../../src/repositories/invoice.repository");
    const invoiceService = await import("../../src/services/invoice.service");
    const quickSaleService = await import("../../src/services/quick-sale.service");
    const { processWebhook } = await import("../../src/services/payment-webhook.service");

    const orgId = randomUUID();
    await withOrgScope(orgId, (tx) =>
      tx.organisation.create({
        data: { id: orgId, name: "Quick Sale Fee Test Org", country: "NG" },
      }),
    );
    createdOrgIds.push(orgId);
    const actorId = randomUUID();

    const amount = 150_000; // 1% = 1500, well under the 2000 cap

    const client = await withOrgScope(orgId, (tx) =>
      tx.client.create({
        data: { id: randomUUID(), orgId, name: "Fee Parity Client", paymentTerms: 14 },
      }),
    );
    const manualInvoice = await invoiceRepo.createInvoice(orgId, {
      clientId: client.id,
      lineItems: [{ description: "Services rendered", quantity: 1, unitPrice: amount }],
      subtotal: amount,
      tax: 0,
      discount: 0,
      total: amount,
      currency: "NGN",
      dueDate: new Date("2026-08-01"),
    });
    await invoiceService.sendInvoice(orgId, manualInvoice.id);

    const quickSale = await quickSaleService.createQuickSale(orgId, actorId, {
      amount,
      currency: "NGN",
    });
    expect(quickSale.clientId).toBeNull();
    expect(quickSale.status).toBe("sent"); // already payable — no manual "send" step

    const manualEventId = Math.floor(Math.random() * 1_000_000_000);
    const manualBody = chargeSuccessBody(manualEventId, manualInvoice.paymentPortalToken, amount);
    const manualOutcome = await processWebhook(
      "paystack",
      manualBody,
      signBody(manualBody.toString()),
    );
    expect(manualOutcome).toBe("processed");

    const quickSaleEventId = Math.floor(Math.random() * 1_000_000_000);
    const quickSaleBody = chargeSuccessBody(quickSaleEventId, quickSale.paymentPortalToken, amount);
    const quickSaleOutcome = await processWebhook(
      "paystack",
      quickSaleBody,
      signBody(quickSaleBody.toString()),
    );
    expect(quickSaleOutcome).toBe("processed");

    const [manualMarkups, quickSaleMarkups] = await Promise.all([
      withOrgScope(orgId, (tx) =>
        tx.transactionMarkup.findMany({ where: { orgId, invoiceId: manualInvoice.id } }),
      ),
      withOrgScope(orgId, (tx) =>
        tx.transactionMarkup.findMany({ where: { orgId, invoiceId: quickSale.id } }),
      ),
    ]);

    expect(manualMarkups).toHaveLength(1);
    expect(quickSaleMarkups).toHaveLength(1);
    // The actual parity assertion: same gross amount must produce the
    // exact same Vela fee, regardless of which flow generated the payment.
    expect(quickSaleMarkups[0]?.velaFeeAmount.toString()).toBe(
      manualMarkups[0]?.velaFeeAmount.toString(),
    );
    expect(quickSaleMarkups[0]?.velaFeeAmount.toString()).toBe("1500");
    expect(quickSaleMarkups[0]?.velaMarkupPct.toString()).toBe(
      manualMarkups[0]?.velaMarkupPct.toString(),
    );

    const paidQuickSale = await invoiceRepo.findById(orgId, quickSale.id);
    expect(paidQuickSale?.status).toBe("paid");
  }, 30_000);

  it("a capped amount (>= ₦200,000) is capped identically for both flows", async () => {
    const { withOrgScope } = await import("../../src/lib/prisma");
    const invoiceRepo = await import("../../src/repositories/invoice.repository");
    const invoiceService = await import("../../src/services/invoice.service");
    const quickSaleService = await import("../../src/services/quick-sale.service");
    const { processWebhook } = await import("../../src/services/payment-webhook.service");

    const orgId = randomUUID();
    await withOrgScope(orgId, (tx) =>
      tx.organisation.create({
        data: { id: orgId, name: "Quick Sale Fee Cap Test Org", country: "NG" },
      }),
    );
    createdOrgIds.push(orgId);
    const actorId = randomUUID();

    const amount = 500_000; // 1% = 5000, capped to MARKUP_CAP_AMOUNT (2000)

    const client = await withOrgScope(orgId, (tx) =>
      tx.client.create({
        data: { id: randomUUID(), orgId, name: "Fee Cap Client", paymentTerms: 14 },
      }),
    );
    const manualInvoice = await invoiceRepo.createInvoice(orgId, {
      clientId: client.id,
      lineItems: [{ description: "Large services", quantity: 1, unitPrice: amount }],
      subtotal: amount,
      tax: 0,
      discount: 0,
      total: amount,
      currency: "NGN",
      dueDate: new Date("2026-08-01"),
    });
    await invoiceService.sendInvoice(orgId, manualInvoice.id);

    const quickSale = await quickSaleService.createQuickSale(orgId, actorId, {
      amount,
      currency: "NGN",
    });

    const manualBody = chargeSuccessBody(
      Math.floor(Math.random() * 1_000_000_000),
      manualInvoice.paymentPortalToken,
      amount,
    );
    await processWebhook("paystack", manualBody, signBody(manualBody.toString()));

    const quickSaleBody = chargeSuccessBody(
      Math.floor(Math.random() * 1_000_000_000),
      quickSale.paymentPortalToken,
      amount,
    );
    await processWebhook("paystack", quickSaleBody, signBody(quickSaleBody.toString()));

    const [manualMarkups, quickSaleMarkups] = await Promise.all([
      withOrgScope(orgId, (tx) =>
        tx.transactionMarkup.findMany({ where: { orgId, invoiceId: manualInvoice.id } }),
      ),
      withOrgScope(orgId, (tx) =>
        tx.transactionMarkup.findMany({ where: { orgId, invoiceId: quickSale.id } }),
      ),
    ]);

    expect(manualMarkups[0]?.velaFeeAmount.toString()).toBe("2000");
    expect(quickSaleMarkups[0]?.velaFeeAmount.toString()).toBe("2000");
  }, 30_000);
});
