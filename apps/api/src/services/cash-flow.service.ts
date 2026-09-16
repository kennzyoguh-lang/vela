import * as bankTransactionRepo from "../repositories/bank-transaction.repository";
import * as bankAccountRepo from "../repositories/bank-account.repository";
import type { BankTransaction } from "@prisma/client";

export interface CashFlowStatement {
  periodLabel: string;
  operatingInflow: number;
  operatingOutflow: number;
  netCashFlow: number;
}

// SIMPLIFICATION (documented, not hidden — same pattern as compliance-
// obligation-rules.ts's CIT/CAC anchors): BRD F-33 asks for operating,
// investing, and financing activities as separate buckets. TransactionCategory
// (schema.prisma) has no category that distinguishes investing/financing
// activity (asset purchases, loan proceeds/repayments, owner draws) from
// ordinary operating income and expense — every synced bank transaction is
// one of income/cost_of_goods/payroll/rent/utilities/marketing/transport/
// other_expense/transfer/uncategorized, all operating in nature. Everything
// below is reported as operating activity until the category taxonomy is
// extended to support the other two; never silently mislabeled as something
// this data can't actually tell apart.
export function calculateCashFlow(
  transactions: Pick<BankTransaction, "type" | "amount" | "category">[],
): CashFlowStatement {
  let operatingInflow = 0;
  let operatingOutflow = 0;

  for (const tx of transactions) {
    if (tx.category === "transfer") continue; // money moving between the business's own accounts
    const amount = Number(tx.amount);
    if (tx.type === "credit") {
      operatingInflow += amount;
    } else {
      operatingOutflow += amount;
    }
  }

  return {
    periodLabel: "",
    operatingInflow,
    operatingOutflow,
    netCashFlow: operatingInflow - operatingOutflow,
  };
}

export async function getCashFlowStatement(
  orgId: string,
  from: Date,
  to: Date,
): Promise<CashFlowStatement> {
  const transactions = await bankTransactionRepo.listByOrgAndRange(orgId, from, to);
  const periodLabel = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
  return { ...calculateCashFlow(transactions), periodLabel };
}

export interface CashFlowProjection {
  currentCashPosition: number;
  averageDailyNetCashFlow: number;
  projected30: number;
  projected60: number;
  historyDays: number;
  hasSufficientHistory: boolean;
}

// Forecasting only begins once sufficient historical data exists (VELA
// Intelligence's own stated principle — avoid false precision). 14 days is
// a deliberately low bar (BRD's own F-33 wants a 60-day projection
// available reasonably soon after a bank account connects), but a
// projection built from less than that is flagged rather than presented as
// a real number — the caller decides whether to render it or a plain
// "connect more history" state.
const MIN_HISTORY_DAYS_FOR_PROJECTION = 14;
const HISTORY_WINDOW_DAYS = 90;

export function projectCashFlow(
  currentCashPosition: number,
  transactions: Pick<BankTransaction, "type" | "amount" | "category" | "transactionDate">[],
  now: Date,
): CashFlowProjection {
  const dates = transactions.map((t) => t.transactionDate.getTime());
  const historyDays =
    dates.length === 0
      ? 0
      : Math.ceil((now.getTime() - Math.min(...dates)) / (1000 * 60 * 60 * 24));
  const hasSufficientHistory = historyDays >= MIN_HISTORY_DAYS_FOR_PROJECTION;

  const { netCashFlow } = calculateCashFlow(transactions);
  const effectiveDays = Math.max(1, Math.min(historyDays, HISTORY_WINDOW_DAYS));
  const averageDailyNetCashFlow = hasSufficientHistory ? netCashFlow / effectiveDays : 0;

  return {
    currentCashPosition,
    averageDailyNetCashFlow,
    projected30: currentCashPosition + averageDailyNetCashFlow * 30,
    projected60: currentCashPosition + averageDailyNetCashFlow * 60,
    historyDays,
    hasSufficientHistory,
  };
}

export async function getCashFlowProjection(orgId: string, now: Date): Promise<CashFlowProjection> {
  const windowStart = new Date(now.getTime() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [accounts, transactions] = await Promise.all([
    bankAccountRepo.listActiveByOrg(orgId),
    bankTransactionRepo.listByOrgAndRange(orgId, windowStart, now),
  ]);
  const currentCashPosition = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
  return projectCashFlow(currentCashPosition, transactions, now);
}
