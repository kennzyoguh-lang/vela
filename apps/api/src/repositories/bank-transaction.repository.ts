import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { BankTransaction, TransactionCategory, TransactionType } from "@prisma/client";
import { toPage, type Page, type PageParams } from "../lib/pagination";

// Idempotent by construction — the @@unique([bankAccountId,
// providerTransactionId]) constraint means a re-sync of a transaction
// already known just no-ops the update, never duplicates the row (same
// upsert-by-external-id shape as webhook_events/compliance_filings). Returns
// whether the row was newly inserted so the caller (bank-transaction.service.ts)
// knows whether to auto-categorize it.
export async function upsertTransaction(
  orgId: string,
  bankAccountId: string,
  input: {
    providerTransactionId: string;
    type: TransactionType;
    amount: number;
    narration: string;
    transactionDate: Date;
    category: TransactionCategory;
  },
): Promise<{ transaction: BankTransaction; wasNew: boolean }> {
  return withOrgScope(orgId, async (tx) => {
    const existing = await tx.bankTransaction.findUnique({
      where: {
        bankAccountId_providerTransactionId: {
          bankAccountId,
          providerTransactionId: input.providerTransactionId,
        },
      },
    });
    if (existing) return { transaction: existing, wasNew: false };

    const transaction = await tx.bankTransaction.create({
      data: {
        id: randomUUID(),
        orgId,
        bankAccountId,
        providerTransactionId: input.providerTransactionId,
        type: input.type,
        amount: input.amount,
        narration: input.narration,
        transactionDate: input.transactionDate,
        category: input.category,
      },
    });
    return { transaction, wasNew: true };
  });
}

export async function listByOrgAndRange(
  orgId: string,
  from: Date,
  to: Date,
): Promise<BankTransaction[]> {
  return withOrgScope(orgId, (tx) =>
    tx.bankTransaction.findMany({
      where: { orgId, transactionDate: { gte: from, lte: to } },
      orderBy: { transactionDate: "desc" },
    }),
  );
}

export async function listByOrg(orgId: string, page: PageParams): Promise<Page<BankTransaction>> {
  return withOrgScope(orgId, async (tx) => {
    const [items, total] = await Promise.all([
      tx.bankTransaction.findMany({
        where: { orgId },
        orderBy: { transactionDate: "desc" },
        skip: page.skip,
        take: page.take,
      }),
      tx.bankTransaction.count({ where: { orgId } }),
    ]);
    return toPage(items, total, page);
  });
}

export async function findById(
  orgId: string,
  transactionId: string,
): Promise<BankTransaction | null> {
  return withOrgScope(orgId, (tx) =>
    tx.bankTransaction.findFirst({ where: { id: transactionId, orgId } }),
  );
}

export async function recategorize(
  orgId: string,
  transactionId: string,
  category: TransactionCategory,
): Promise<BankTransaction> {
  return withOrgScope(orgId, (tx) =>
    tx.bankTransaction.update({
      where: { id: transactionId, orgId },
      data: { category, categorizedManually: true },
    }),
  );
}
