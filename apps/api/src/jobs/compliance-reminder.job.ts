import * as organisationRepo from "../repositories/organisation.repository";
import * as complianceReminderService from "../services/compliance-reminder.service";
import { logger } from "../lib/logger";
import {
  createWorker,
  DEFAULT_JOB_OPTIONS,
  complianceReminderQueue,
  COMPLIANCE_REMINDER_QUEUE,
} from "./queue";

// A missed government filing carries real financial-penalty risk, so — same
// as the invoice reminder scan — one org's failure must not block another's.
export async function runComplianceReminderScan(): Promise<void> {
  const orgIds = await organisationRepo.listAllOrgIds();
  const now = new Date();
  let totalSent = 0;

  for (const orgId of orgIds) {
    try {
      totalSent += await complianceReminderService.processComplianceRemindersForOrg(orgId, now);
    } catch (err) {
      logger.error(
        { orgId, err },
        "Compliance reminder scan failed for org — continuing with the rest of the batch",
      );
    }
  }

  logger.info({ orgCount: orgIds.length, totalSent }, "Compliance reminder scan complete");
}

export function startComplianceReminderWorker() {
  return createWorker(COMPLIANCE_REMINDER_QUEUE, async () => {
    await runComplianceReminderScan();
  });
}

// Daily at 06:15 — after filing generation (06:00) has had a chance to create
// today's rows, ahead of recurring invoices (06:30) and invoice reminders (07:00).
export async function scheduleComplianceReminderScan(): Promise<void> {
  await complianceReminderQueue.add(
    "daily-compliance-reminder-scan",
    {},
    {
      ...DEFAULT_JOB_OPTIONS,
      repeat: { pattern: "15 6 * * *" },
      jobId: "daily-compliance-reminder-scan",
    },
  );
}
