import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/bank-transaction.repository", () => ({
  listUnmatchedCredits: vi.fn(),
  findById: vi.fn(),
  matchToInvoice: vi.fn(),
  clearMatch: vi.fn(),
}));
vi.mock("../repositories/invoice.repository", () => ({
  listUnpaid: vi.fn(),
}));
vi.mock("./invoice.service", () => ({
  markPaid: vi.fn(),
}));

import * as bankTransactionRepo from "../repositories/bank-transaction.repository";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as invoiceService from "./invoice.service";
import * as reconciliationService from "./reconciliation.service";

function transactionStub(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    type: "credit",
    amount: 50000,
    narration: "Transfer from client",
    transactionDate: new Date("2026-08-10"),
    matchedInvoiceId: null,
    ...overrides,
  };
}

function invoiceStub(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    number: "INV-0001",
    clientId: randomUUID(),
    total: 50000,
    dueDate: new Date("2026-08-08"),
    ...overrides,
  };
}

describe("reconciliation.service", () => {
  const orgId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("suggestMatches", () => {
    it("suggests an exact-amount match, ranked ahead of a close one", async () => {
      const transaction = transactionStub({ amount: 50000 });
      const exactInvoice = invoiceStub({ total: 50000 });
      const closeInvoice = invoiceStub({ total: 50100 });
      vi.mocked(bankTransactionRepo.listUnmatchedCredits).mockResolvedValue([transaction] as never);
      vi.mocked(invoiceRepo.listUnpaid).mockResolvedValue([closeInvoice, exactInvoice] as never);

      const suggestions = await reconciliationService.suggestMatches(orgId);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]!.candidates.map((c) => c.invoiceId)).toEqual([
        exactInvoice.id,
        closeInvoice.id,
      ]);
      expect(suggestions[0]!.candidates[0]!.confidence).toBe("exact");
      expect(suggestions[0]!.candidates[1]!.confidence).toBe("close");
    });

    it("excludes an invoice whose amount is too far off to plausibly match", async () => {
      const transaction = transactionStub({ amount: 50000 });
      const unrelatedInvoice = invoiceStub({ total: 200000 });
      vi.mocked(bankTransactionRepo.listUnmatchedCredits).mockResolvedValue([transaction] as never);
      vi.mocked(invoiceRepo.listUnpaid).mockResolvedValue([unrelatedInvoice] as never);

      const suggestions = await reconciliationService.suggestMatches(orgId);

      expect(suggestions).toHaveLength(0);
    });

    it("omits a transaction from the results entirely when it has no candidates", async () => {
      vi.mocked(bankTransactionRepo.listUnmatchedCredits).mockResolvedValue([
        transactionStub({ amount: 12345 }),
      ] as never);
      vi.mocked(invoiceRepo.listUnpaid).mockResolvedValue([]);

      const suggestions = await reconciliationService.suggestMatches(orgId);

      expect(suggestions).toEqual([]);
    });
  });

  describe("confirmMatch", () => {
    it("marks the invoice paid and records the match on the transaction", async () => {
      const transaction = transactionStub();
      const invoiceId = randomUUID();
      vi.mocked(bankTransactionRepo.findById).mockResolvedValue(transaction as never);

      await reconciliationService.confirmMatch(orgId, transaction.id, invoiceId);

      expect(invoiceService.markPaid).toHaveBeenCalledWith(orgId, invoiceId);
      expect(bankTransactionRepo.matchToInvoice).toHaveBeenCalledWith(
        orgId,
        transaction.id,
        invoiceId,
      );
    });

    it("rejects matching a debit transaction", async () => {
      const transaction = transactionStub({ type: "debit" });
      vi.mocked(bankTransactionRepo.findById).mockResolvedValue(transaction as never);

      await expect(
        reconciliationService.confirmMatch(orgId, transaction.id, randomUUID()),
      ).rejects.toThrow(/credit/);
      expect(invoiceService.markPaid).not.toHaveBeenCalled();
    });

    it("rejects a transaction that's already matched", async () => {
      const transaction = transactionStub({ matchedInvoiceId: randomUUID() });
      vi.mocked(bankTransactionRepo.findById).mockResolvedValue(transaction as never);

      await expect(
        reconciliationService.confirmMatch(orgId, transaction.id, randomUUID()),
      ).rejects.toThrow(/already matched/);
      expect(invoiceService.markPaid).not.toHaveBeenCalled();
    });

    it("does not record the match if marking the invoice paid fails", async () => {
      const transaction = transactionStub();
      vi.mocked(bankTransactionRepo.findById).mockResolvedValue(transaction as never);
      vi.mocked(invoiceService.markPaid).mockRejectedValue(new Error("invalid transition"));

      await expect(
        reconciliationService.confirmMatch(orgId, transaction.id, randomUUID()),
      ).rejects.toThrow(/invalid transition/);
      expect(bankTransactionRepo.matchToInvoice).not.toHaveBeenCalled();
    });

    it("throws when the transaction doesn't exist", async () => {
      vi.mocked(bankTransactionRepo.findById).mockResolvedValue(null);

      await expect(
        reconciliationService.confirmMatch(orgId, randomUUID(), randomUUID()),
      ).rejects.toThrow(/not found/);
    });
  });

  describe("undoMatch", () => {
    it("clears the match without touching the invoice", async () => {
      const transaction = transactionStub({ matchedInvoiceId: randomUUID() });
      vi.mocked(bankTransactionRepo.findById).mockResolvedValue(transaction as never);

      await reconciliationService.undoMatch(orgId, transaction.id);

      expect(bankTransactionRepo.clearMatch).toHaveBeenCalledWith(orgId, transaction.id);
      expect(invoiceService.markPaid).not.toHaveBeenCalled();
    });

    it("throws when the transaction isn't currently matched", async () => {
      const transaction = transactionStub({ matchedInvoiceId: null });
      vi.mocked(bankTransactionRepo.findById).mockResolvedValue(transaction as never);

      await expect(reconciliationService.undoMatch(orgId, transaction.id)).rejects.toThrow(
        /isn't matched/,
      );
    });
  });
});
