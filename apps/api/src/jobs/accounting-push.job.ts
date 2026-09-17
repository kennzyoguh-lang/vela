import * as connectionRepo from "../repositories/accounting-connection.repository";
import * as connectionService from "../services/accounting-connection.service";
import { logger } from "../lib/logger";
import {
  createWorker,
  DEFAULT_JOB_OPTIONS,
  accountingPushQueue,
  ACCOUNTING_PUSH_QUEUE,
} from "./queue";

// F-connectors' one-way (Vela -> provider) sync — every org with an active
// QuickBooks/Xero connection gets its not-yet-pushed sent/paid invoices
// pushed once a day. 04:45, right after the quote-expiry scan, ahead of
// everything else in the 05:00+ stagger (same reasoning as
// invoice-overdue.job.ts/quote-expiry.job.ts: this has no time-of-day
// sensitivity of its own, so it just needs a slot before the jobs that do).
export async function runAccountingPushScan(): Promise<void> {
  const connections = await connectionRepo.listAllActiveRefs();
  let totalPushed = 0;
  for (const { orgId, provider } of connections) {
    try {
      totalPushed += await connectionService.pushPendingInvoices(orgId, provider);
    } catch (err) {
      logger.error(
        { orgId, provider, err },
        "Accounting push scan failed for connection — continuing with the rest of the batch",
      );
    }
  }
  logger.info(
    { connectionCount: connections.length, totalPushed },
    "Daily accounting push scan complete",
  );
}

export function startAccountingPushWorker() {
  return createWorker(ACCOUNTING_PUSH_QUEUE, async () => {
    await runAccountingPushScan();
  });
}

export async function scheduleAccountingPushScan(): Promise<void> {
  await accountingPushQueue.add(
    "daily-accounting-push-scan",
    {},
    {
      ...DEFAULT_JOB_OPTIONS,
      repeat: { pattern: "45 4 * * *" },
      jobId: "daily-accounting-push-scan",
    },
  );
}
