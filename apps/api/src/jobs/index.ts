import { startReminderWorker, scheduleReminderScan } from "./reminder.job";
import {
  startRecurringInvoiceWorker,
  scheduleRecurringInvoiceGeneration,
} from "./recurring-invoice.job";
import { startRiskScoringWorker, scheduleRiskScoring } from "./risk-scoring.job";
import { logger } from "../lib/logger";

export async function startJobs() {
  const workers = [startReminderWorker(), startRecurringInvoiceWorker(), startRiskScoringWorker()];

  await Promise.all([
    scheduleReminderScan(),
    scheduleRecurringInvoiceGeneration(),
    scheduleRiskScoring(),
  ]);

  logger.info("Background job workers started and daily schedules registered");
  return workers;
}
