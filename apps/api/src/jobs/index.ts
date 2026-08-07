import { startReminderWorker, scheduleReminderScan } from "./reminder.job";
import {
  startRecurringInvoiceWorker,
  scheduleRecurringInvoiceGeneration,
} from "./recurring-invoice.job";
import { startRiskScoringWorker, scheduleRiskScoring } from "./risk-scoring.job";
import {
  startComplianceFilingGenerationWorker,
  scheduleComplianceFilingGeneration,
} from "./compliance-filing-generation.job";
import {
  startComplianceReminderWorker,
  scheduleComplianceReminderScan,
} from "./compliance-reminder.job";
import { startBankSyncWorker, scheduleBankSync } from "./bank-sync.job";
import { startOwnerSummaryWorker, scheduleOwnerSummaryScan } from "./owner-summary.job";
import { startNurtureEmailWorker } from "./nurture-email.job";
import { logger } from "../lib/logger";

export async function startJobs() {
  const workers = [
    startReminderWorker(),
    startRecurringInvoiceWorker(),
    startRiskScoringWorker(),
    startComplianceFilingGenerationWorker(),
    startComplianceReminderWorker(),
    startBankSyncWorker(),
    startOwnerSummaryWorker(),
    // Per-signup delayed jobs, not a daily schedule — no scheduleXxx()
    // counterpart below, see nurture-email.job.ts#scheduleNurtureEmails.
    startNurtureEmailWorker(),
  ];

  await Promise.all([
    scheduleReminderScan(),
    scheduleRecurringInvoiceGeneration(),
    scheduleRiskScoring(),
    scheduleComplianceFilingGeneration(),
    scheduleComplianceReminderScan(),
    scheduleBankSync(),
    scheduleOwnerSummaryScan(),
  ]);

  logger.info("Background job workers started and daily schedules registered");
  return workers;
}
