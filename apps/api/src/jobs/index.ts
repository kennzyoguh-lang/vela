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
import { logger } from "../lib/logger";

export async function startJobs() {
  const workers = [
    startReminderWorker(),
    startRecurringInvoiceWorker(),
    startRiskScoringWorker(),
    startComplianceFilingGenerationWorker(),
    startComplianceReminderWorker(),
    startBankSyncWorker(),
  ];

  await Promise.all([
    scheduleReminderScan(),
    scheduleRecurringInvoiceGeneration(),
    scheduleRiskScoring(),
    scheduleComplianceFilingGeneration(),
    scheduleComplianceReminderScan(),
    scheduleBankSync(),
  ]);

  logger.info("Background job workers started and daily schedules registered");
  return workers;
}
