import * as organisationRepo from "../repositories/organisation.repository";
import * as ownerSummaryService from "../services/owner-summary.service";
import { logger } from "../lib/logger";
import { createWorker, DEFAULT_JOB_OPTIONS, ownerSummaryQueue, OWNER_SUMMARY_QUEUE } from "./queue";

// One org's summary failing (e.g. a transient DB hiccup) must not block any
// other org's — same per-org try/catch isolation as every prior job.
export async function runOwnerSummaryScan(): Promise<void> {
  const orgIds = await organisationRepo.listAllOrgIds();
  const now = new Date();
  let sent = 0;

  for (const orgId of orgIds) {
    try {
      await ownerSummaryService.sendDailySummary(orgId, now);
      sent++;
    } catch (err) {
      logger.error(
        { orgId, err },
        "Owner daily summary failed for org — continuing with the rest of the batch",
      );
    }
  }

  logger.info({ orgCount: orgIds.length, sent }, "Owner daily summary scan complete");
}

export function startOwnerSummaryWorker() {
  return createWorker(OWNER_SUMMARY_QUEUE, async () => {
    await runOwnerSummaryScan();
  });
}

// Daily at 20:00 UTC (~21:00 WAT) — deliberately an evening slot, unlike
// every other job's early-morning slot, since this summarizes a business day
// that needs to have actually finished (same WAT-day reasoning as
// cash-check.service.ts's businessDayRange, applied to scheduling this time).
export async function scheduleOwnerSummaryScan(): Promise<void> {
  await ownerSummaryQueue.add(
    "daily-owner-summary",
    {},
    { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: "0 20 * * *" }, jobId: "daily-owner-summary" },
  );
}
