import * as organisationRepo from "../repositories/organisation.repository";
import * as bankAccountRepo from "../repositories/bank-account.repository";
import * as bankTransactionService from "../services/bank-transaction.service";
import { logger } from "../lib/logger";
import { createWorker, DEFAULT_JOB_OPTIONS, bankSyncQueue, BANK_SYNC_QUEUE } from "./queue";

// One account's sync failure (e.g. a revoked bank connection) must not block
// any other account or org's sync — same per-org try/catch isolation as
// every prior job, applied per-account here since a single org can have
// several linked accounts.
export async function runBankSync(): Promise<void> {
  const orgIds = await organisationRepo.listAllOrgIds();
  let totalSynced = 0;

  for (const orgId of orgIds) {
    const accounts = await bankAccountRepo.listActiveByOrg(orgId);
    for (const account of accounts) {
      try {
        totalSynced += await bankTransactionService.syncTransactions(orgId, account.id);
      } catch (err) {
        logger.error(
          { orgId, bankAccountId: account.id, err },
          "Bank sync failed for account — continuing with the rest of the batch",
        );
      }
    }
  }

  logger.info({ orgCount: orgIds.length, totalSynced }, "Bank sync complete");
}

export function startBankSyncWorker() {
  return createWorker(BANK_SYNC_QUEUE, async () => {
    await runBankSync();
  });
}

// Daily at 05:45 — ahead of compliance filing generation (06:00), recurring
// invoices (06:30), and invoice reminders (07:00) so the system-wide scans
// don't contend for the same minute.
export async function scheduleBankSync(): Promise<void> {
  await bankSyncQueue.add(
    "daily-bank-sync",
    {},
    { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: "45 5 * * *" }, jobId: "daily-bank-sync" },
  );
}
