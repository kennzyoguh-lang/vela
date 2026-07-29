import * as organisationRepo from "../repositories/organisation.repository";
import * as reminderService from "../services/reminder.service";
import { logger } from "../lib/logger";
import { createWorker, DEFAULT_JOB_OPTIONS, reminderQueue, REMINDER_QUEUE } from "./queue";

// BRD F-04: daily scan across every org — a missed reminder is a real revenue
// risk for the customer (unlike the cash-flow job, one org's failure here
// must not silently swallow another's, so each org is processed independently
// with its own try/catch, Handbook 5.8's "must not block others in the batch").
export async function runReminderScan(): Promise<void> {
  const orgIds = await organisationRepo.listAllOrgIds();
  const now = new Date();
  let totalSent = 0;

  for (const orgId of orgIds) {
    try {
      totalSent += await reminderService.processRemindersForOrg(orgId, now);
    } catch (err) {
      logger.error(
        { orgId, err },
        "Reminder scan failed for org — continuing with the rest of the batch",
      );
    }
  }

  logger.info({ orgCount: orgIds.length, totalSent }, "Reminder scan complete");
}

export function startReminderWorker() {
  return createWorker(REMINDER_QUEUE, async () => {
    await runReminderScan();
  });
}

// Daily at 07:00 — ahead of ComplianceRadar's 06:00 slot (Handbook 5.8) so the
// two system-wide scans don't contend for the same minute.
export async function scheduleReminderScan(): Promise<void> {
  await reminderQueue.add(
    "daily-reminder-scan",
    {},
    { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: "0 7 * * *" }, jobId: "daily-reminder-scan" },
  );
}
