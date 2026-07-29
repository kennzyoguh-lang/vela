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
import { logger } from "../lib/logger";

export async function startJobs() {
  const workers = [
    startReminderWorker(),
    startRecurringInvoiceWorker(),
    startRiskScoringWorker(),
    startComplianceFilingGenerationWorker(),
    startComplianceReminderWorker(),
  ];

  await Promise.all([
    scheduleReminderScan(),
    scheduleRecurringInvoiceGeneration(),
    scheduleRiskScoring(),
    scheduleComplianceFilingGeneration(),
    scheduleComplianceReminderScan(),
  ]);

  logger.info("Background job workers started and daily schedules registered");
  return workers;
}
