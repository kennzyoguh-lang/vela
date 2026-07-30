import * as bankAccountRepo from "../repositories/bank-account.repository";
import * as bankTransactionRepo from "../repositories/bank-transaction.repository";
import { getBankSyncGateway } from "./bank-sync";
import { categorizeTransaction } from "./transaction-categorization.service";
import { NotFoundError } from "../lib/errors";
import type { TransactionCategory } from "@prisma/client";
import type { PageParams } from "../lib/pagination";

/**
 * Fetches everything new since the account's last sync, upserts by
 * providerTransactionId (idempotent — safe to re-run), and auto-categorizes
 * only the newly-inserted rows. Returns how many were new.
 */
export async function syncTransactions(orgId: string, bankAccountId: string): Promise<number> {
  const account = await bankAccountRepo.findById(orgId, bankAccountId);
  if (!account) throw new NotFoundError("Bank account not found");

  const gateway = getBankSyncGateway(account.provider);
  const raw = await gateway.fetchTransactions(
    account.providerAccountId,
    account.lastSyncedAt ?? undefined,
  );

  let newCount = 0;
  for (const rawTransaction of raw) {
    const { wasNew } = await bankTransactionRepo.upsertTransaction(orgId, bankAccountId, {
      providerTransactionId: rawTransaction.providerTransactionId,
      type: rawTransaction.type,
      amount: rawTransaction.amount,
      narration: rawTransaction.narration,
      transactionDate: rawTransaction.transactionDate,
      category: categorizeTransaction(rawTransaction.narration, rawTransaction.type),
    });
    if (wasNew) newCount++;
  }

  const balance = await gateway.fetchBalance(account.providerAccountId);
  await bankAccountRepo.updateBalance(orgId, bankAccountId, balance);

  return newCount;
}

export async function listTransactions(orgId: string, page: PageParams) {
  return bankTransactionRepo.listByOrg(orgId, page);
}

export async function recategorizeTransaction(
  orgId: string,
  transactionId: string,
  category: TransactionCategory,
) {
  const transaction = await bankTransactionRepo.findById(orgId, transactionId);
  if (!transaction) throw new NotFoundError("Transaction not found");
  return bankTransactionRepo.recategorize(orgId, transactionId, category);
}
