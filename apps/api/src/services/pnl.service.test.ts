import { describe, it, expect } from "vitest";
import { calculatePnl } from "./pnl.service";
import type { BankTransaction, TransactionCategory, TransactionType } from "@prisma/client";

type PnlInput = Pick<BankTransaction, "type" | "amount" | "category">;

function tx(type: TransactionType, amount: number, category: TransactionCategory): PnlInput {
  return { type, amount, category } as unknown as PnlInput;
}

describe("pnl.service", () => {
  describe("calculatePnl", () => {
    it("returns all zeros for an empty period", () => {
      const result = calculatePnl([]);
      expect(result).toEqual({ income: 0, expensesByCategory: {}, totalExpenses: 0, netProfit: 0 });
    });

    it("sums credits into income and debits into their category bucket", () => {
      const result = calculatePnl([
        tx("credit", 500_000, "income"),
        tx("credit", 100_000, "income"),
        tx("debit", 50_000, "rent"),
        tx("debit", 20_000, "utilities"),
        tx("debit", 10_000, "utilities"),
      ]);

      expect(result.income).toBe(600_000);
      expect(result.expensesByCategory).toEqual({ rent: 50_000, utilities: 30_000 });
      expect(result.totalExpenses).toBe(80_000);
      expect(result.netProfit).toBe(520_000);
    });

    it("excludes transfer transactions from both income and expenses", () => {
      const result = calculatePnl([
        tx("credit", 200_000, "income"),
        tx("debit", 150_000, "transfer"), // moved to another own account — not P&L relevant
      ]);

      expect(result.income).toBe(200_000);
      expect(result.expensesByCategory.transfer).toBeUndefined();
      expect(result.totalExpenses).toBe(0);
      expect(result.netProfit).toBe(200_000);
    });

    it("produces a negative net profit for a loss-making period", () => {
      const result = calculatePnl([tx("credit", 50_000, "income"), tx("debit", 80_000, "payroll")]);

      expect(result.netProfit).toBe(-30_000);
    });

    it("groups uncategorized debits under their own bucket rather than dropping them", () => {
      const result = calculatePnl([tx("debit", 15_000, "uncategorized")]);
      expect(result.expensesByCategory.uncategorized).toBe(15_000);
      expect(result.totalExpenses).toBe(15_000);
    });
  });
});
