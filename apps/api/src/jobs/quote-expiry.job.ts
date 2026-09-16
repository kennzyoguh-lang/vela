import * as organisationRepo from "../repositories/organisation.repository";
import * as quoteService from "../services/quote.service";
import { logger } from "../lib/logger";
import { createWorker, DEFAULT_JOB_OPTIONS, quoteExpiryQueue, QUOTE_EXPIRY_QUEUE } from "./queue";

// Same gap, same fix, as invoice-overdue.job.ts — quote.service.ts's
// markExpired existed and was tested but never actually ran. 04:30, right
// after the invoice scan, ahead of everything else in the 05:00+ stagger.
export async function runQuoteExpiryScan(): Promise<void> {
  const orgIds = await organisationRepo.listAllOrgIds();
  let totalMarked = 0;
  for (const orgId of orgIds) {
    try {
      totalMarked += await quoteService.markAllExpired(orgId);
    } catch (err) {
      logger.error(
        { orgId, err },
        "Quote expiry scan failed for org — continuing with the rest of the batch",
      );
    }
  }
  logger.info({ orgCount: orgIds.length, totalMarked }, "Daily quote expiry scan complete");
}

export function startQuoteExpiryWorker() {
  return createWorker(QUOTE_EXPIRY_QUEUE, async () => {
    await runQuoteExpiryScan();
  });
}

export async function scheduleQuoteExpiryScan(): Promise<void> {
  await quoteExpiryQueue.add(
    "daily-quote-expiry-scan",
    {},
    { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: "30 4 * * *" }, jobId: "daily-quote-expiry-scan" },
  );
}
