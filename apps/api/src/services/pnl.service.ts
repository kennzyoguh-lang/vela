import * as bankTransactionRepo from "../repositories/bank-transaction.repository";
import type { BankTransaction, TransactionCategory } from "@prisma/client";

export interface PnlResult {
  income: number;
  expensesByCategory: Partial<Record<TransactionCategory, number>>;
  totalExpenses: number;
  netProfit: number;
}

// Pure aggregation, no DB access — takes exactly the facts it needs, same
// style as invoice-risk.service.ts's calculateRiskScore. "transfer" is
// excluded from both income and expenses since it represents money moving
// between the business's own accounts, not P&L-relevant activity.
export function calculatePnl(
  transactions: Pick<BankTransaction, "type" | "amount" | "category">[],
): PnlResult {
  let income = 0;
  const expensesByCategory: Partial<Record<TransactionCategory, number>> = {};

  for (const tx of transactions) {
    if (tx.category === "transfer") continue;
    const amount = Number(tx.amount);
    if (tx.type === "credit") {
      income += amount;
    } else {
      expensesByCategory[tx.category] = (expensesByCategory[tx.category] ?? 0) + amount;
    }
  }

  const totalExpenses = Object.values(expensesByCategory).reduce(
    (sum, value) => sum + (value ?? 0),
    0,
  );

  return { income, expensesByCategory, totalExpenses, netProfit: income - totalExpenses };
}

export async function getPnlStatement(orgId: string, from: Date, to: Date): Promise<PnlResult> {
  const transactions = await bankTransactionRepo.listByOrgAndRange(orgId, from, to);
  return calculatePnl(transactions);
}
