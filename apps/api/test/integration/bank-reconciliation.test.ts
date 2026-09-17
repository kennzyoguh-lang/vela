// Bank reconciliation — proves the suggestion/confirm/undo round trip against
// the real database (RLS-scoped queries via withOrgScope), and that the HTTP
// routes are owner/admin gated the same way payroll/payment-credential
// mutations are (rbac.test.ts's own precedent for this shape).
import request from "supertest";
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;

describe("Bank reconciliation (real DB)", () => {
  let app: Express;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    if (createdOrgIds.length > 0) {
      try {
        await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
      } catch (err) {
        // Best-effort cleanup only - a teardown failure here must never mask the
        // real pass/fail result of this file's actual assertions above.
        console.warn("org cleanup failed (non-fatal):", err);
      }
    }
    await prisma.$disconnect();
  });

  async function setUpOrgWithSentInvoice(total: number) {
    const { withOrgScope } = await import("../../src/lib/prisma");
    const invoiceRepo = await import("../../src/repositories/invoice.repository");
    const invoiceService = await import("../../src/services/invoice.service");

    const orgId = randomUUID();
    await withOrgScope(orgId, (tx) =>
      tx.organisation.create({
        data: { id: orgId, name: "Bank Reconciliation Test Org", country: "NG" },
      }),
    );
    createdOrgIds.push(orgId);

    const client = await withOrgScope(orgId, (tx) =>
      tx.client.create({
        data: { id: randomUUID(), orgId, name: "Reconciliation Test Client", paymentTerms: 14 },
      }),
    );

    const invoice = await invoiceRepo.createInvoice(orgId, {
      clientId: client.id,
      lineItems: [{ description: "Services rendered", quantity: 1, unitPrice: total }],
      subtotal: total,
      tax: 0,
      discount: 0,
      total,
      currency: "NGN",
      dueDate: new Date("2026-08-01"),
    });
    await invoiceService.sendInvoice(orgId, invoice.id);

    const bankAccount = await withOrgScope(orgId, (tx) =>
      tx.bankAccount.create({
        data: {
          id: randomUUID(),
          orgId,
          provider: "mono",
          providerAccountId: `mono-acct-${randomUUID()}`,
          institutionName: "Test Bank",
          accountType: "current",
          accountNumberMasked: "****1234",
        },
      }),
    );

    return { orgId, invoice, bankAccount };
  }

  it(
    "suggests an exact-amount match, confirms it, and marks the invoice paid",
    async () => {
      const { orgId, invoice, bankAccount } = await setUpOrgWithSentInvoice(50_000);
      const { withOrgScope } = await import("../../src/lib/prisma");
      const reconciliationService = await import("../../src/services/reconciliation.service");
      const invoiceRepo = await import("../../src/repositories/invoice.repository");

      const transaction = await withOrgScope(orgId, (tx) =>
        tx.bankTransaction.create({
          data: {
            id: randomUUID(),
            orgId,
            bankAccountId: bankAccount.id,
            providerTransactionId: `mono-txn-${randomUUID()}`,
            type: "credit",
            amount: 50_000,
            narration: "Transfer from Reconciliation Test Client",
            transactionDate: new Date("2026-07-28"),
          },
        }),
      );

      const suggestions = await reconciliationService.suggestMatches(orgId);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]!.transactionId).toBe(transaction.id);
      expect(suggestions[0]!.candidates).toEqual([
        expect.objectContaining({ invoiceId: invoice.id, confidence: "exact" }),
      ]);

      await reconciliationService.confirmMatch(orgId, transaction.id, invoice.id);

      const paidInvoice = await invoiceRepo.findById(orgId, invoice.id);
      expect(paidInvoice?.status).toBe("paid");
      const matched = await withOrgScope(orgId, (tx) =>
        tx.bankTransaction.findFirst({ where: { id: transaction.id, orgId } }),
      );
      expect(matched?.matchedInvoiceId).toBe(invoice.id);

      // Once matched, this transaction and invoice drop out of future suggestions.
      const suggestionsAfter = await reconciliationService.suggestMatches(orgId);
      expect(suggestionsAfter).toHaveLength(0);

      // Undoing clears the transaction-side link but never reverts the invoice.
      await reconciliationService.undoMatch(orgId, transaction.id);
      const unmatched = await withOrgScope(orgId, (tx) =>
        tx.bankTransaction.findFirst({ where: { id: transaction.id, orgId } }),
      );
      expect(unmatched?.matchedInvoiceId).toBeNull();
      const stillPaidInvoice = await invoiceRepo.findById(orgId, invoice.id);
      expect(stillPaidInvoice?.status).toBe("paid");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "rejects a staff-role user from confirming or undoing a match, but allows an owner",
    async () => {
      const { orgId, invoice, bankAccount } = await setUpOrgWithSentInvoice(75_000);
      const { withOrgScope } = await import("../../src/lib/prisma");
      const { signAccessToken } = await import("../../src/services/jwt.service");

      const transaction = await withOrgScope(orgId, (tx) =>
        tx.bankTransaction.create({
          data: {
            id: randomUUID(),
            orgId,
            bankAccountId: bankAccount.id,
            providerTransactionId: `mono-txn-${randomUUID()}`,
            type: "credit",
            amount: 75_000,
            narration: "Transfer from Reconciliation Test Client",
            transactionDate: new Date("2026-07-29"),
          },
        }),
      );

      const ownerId = randomUUID();
      await withOrgScope(orgId, (tx) =>
        tx.user.create({
          data: {
            id: ownerId,
            orgId,
            name: "Owner",
            email: `reconciliation-owner-${orgId}@example.com`,
            passwordHash: "irrelevant-for-this-test",
            role: "owner",
          },
        }),
      );
      const ownerToken = signAccessToken({
        sub: ownerId,
        orgId,
        role: "owner",
        sessionFamilyId: randomUUID(),
      });

      const staffId = randomUUID();
      await withOrgScope(orgId, (tx) =>
        tx.user.create({
          data: {
            id: staffId,
            orgId,
            name: "Staff",
            email: `reconciliation-staff-${orgId}@example.com`,
            passwordHash: "irrelevant-for-this-test",
            role: "staff",
          },
        }),
      );
      const staffToken = signAccessToken({
        sub: staffId,
        orgId,
        role: "staff",
        sessionFamilyId: randomUUID(),
      });

      const staffSuggestionsRes = await request(app)
        .get("/v1/bank-transactions/reconciliation/suggestions")
        .set("Authorization", `Bearer ${staffToken}`);
      expect(staffSuggestionsRes.status).toBe(403);

      const staffConfirmRes = await request(app)
        .post(`/v1/bank-transactions/${transaction.id}/reconciliation`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ invoiceId: invoice.id });
      expect(staffConfirmRes.status).toBe(403);

      const ownerConfirmRes = await request(app)
        .post(`/v1/bank-transactions/${transaction.id}/reconciliation`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ invoiceId: invoice.id });
      expect(ownerConfirmRes.status).toBe(200);

      const staffUndoRes = await request(app)
        .delete(`/v1/bank-transactions/${transaction.id}/reconciliation`)
        .set("Authorization", `Bearer ${staffToken}`);
      expect(staffUndoRes.status).toBe(403);

      const ownerUndoRes = await request(app)
        .delete(`/v1/bank-transactions/${transaction.id}/reconciliation`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(ownerUndoRes.status).toBe(200);
    },
    TEST_TIMEOUT_MS,
  );
});
