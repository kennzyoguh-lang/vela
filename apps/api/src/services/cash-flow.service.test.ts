import { describe, it, expect } from "vitest";
import { calculateCashFlow, projectCashFlow } from "./cash-flow.service";
import type { BankTransaction, TransactionCategory, TransactionType } from "@prisma/client";

type CashFlowInput = Pick<BankTransaction, "type" | "amount" | "category">;
type ProjectionInput = Pick<BankTransaction, "type" | "amount" | "category" | "transactionDate">;

function tx(type: TransactionType, amount: number, category: TransactionCategory): CashFlowInput {
  return { type, amount, category } as unknown as CashFlowInput;
}

function txAt(
  type: TransactionType,
  amount: number,
  category: TransactionCategory,
  transactionDate: Date,
): ProjectionInput {
  return { type, amount, category, transactionDate } as unknown as ProjectionInput;
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("cash-flow.service#calculateCashFlow", () => {
  it("returns all zeros for an empty period", () => {
    const result = calculateCashFlow([]);
    expect(result).toEqual({
      periodLabel: "",
      operatingInflow: 0,
      operatingOutflow: 0,
      netCashFlow: 0,
    });
  });

  it("sums credits into inflow and debits into outflow, regardless of category", () => {
    const result = calculateCashFlow([
      tx("credit", 500_000, "income"),
      tx("debit", 50_000, "rent"),
      tx("debit", 20_000, "payroll"),
    ]);

    expect(result.operatingInflow).toBe(500_000);
    expect(result.operatingOutflow).toBe(70_000);
    expect(result.netCashFlow).toBe(430_000);
  });

  it("excludes transfer transactions from both inflow and outflow", () => {
    const result = calculateCashFlow([
      tx("credit", 200_000, "income"),
      tx("debit", 150_000, "transfer"),
      tx("credit", 150_000, "transfer"),
    ]);

    expect(result.operatingInflow).toBe(200_000);
    expect(result.operatingOutflow).toBe(0);
  });

  it("produces a negative net cash flow when outflow exceeds inflow", () => {
    const result = calculateCashFlow([tx("credit", 50_000, "income"), tx("debit", 80_000, "rent")]);
    expect(result.netCashFlow).toBe(-30_000);
  });
});

describe("cash-flow.service#projectCashFlow", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("flags insufficient history below the 14-day minimum and projects zero growth", () => {
    const transactions = [txAt("credit", 100_000, "income", daysAgo(now, 5))];

    const result = projectCashFlow(1_000_000, transactions, now);

    expect(result.hasSufficientHistory).toBe(false);
    expect(result.averageDailyNetCashFlow).toBe(0);
    expect(result.projected30).toBe(1_000_000);
    expect(result.projected60).toBe(1_000_000);
  });

  it("projects forward using the average daily net cash flow once history is sufficient", () => {
    // 20 days of history, net +200,000 over that window -> +10,000/day.
    const transactions = [
      txAt("credit", 400_000, "income", daysAgo(now, 20)),
      txAt("debit", 200_000, "rent", daysAgo(now, 10)),
    ];

    const result = projectCashFlow(1_000_000, transactions, now);

    expect(result.hasSufficientHistory).toBe(true);
    expect(result.averageDailyNetCashFlow).toBe(10_000);
    expect(result.projected30).toBe(1_000_000 + 10_000 * 30);
    expect(result.projected60).toBe(1_000_000 + 10_000 * 60);
  });

  it("projects a declining balance when net cash flow is negative", () => {
    const transactions = [
      txAt("credit", 100_000, "income", daysAgo(now, 20)),
      txAt("debit", 300_000, "payroll", daysAgo(now, 10)),
    ];

    const result = projectCashFlow(500_000, transactions, now);

    expect(result.averageDailyNetCashFlow).toBeLessThan(0);
    expect(result.projected60).toBeLessThan(result.projected30);
    expect(result.projected30).toBeLessThan(500_000);
  });

  it("treats exactly 14 days of history as sufficient (the boundary itself, not one day short)", () => {
    const transactions = [txAt("credit", 140_000, "income", daysAgo(now, 14))];

    const result = projectCashFlow(0, transactions, now);

    expect(result.historyDays).toBe(14);
    expect(result.hasSufficientHistory).toBe(true);
  });
});
