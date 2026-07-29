import * as organisationRepo from "../repositories/organisation.repository";
import * as recurringInvoiceService from "../services/recurring-invoice.service";
import { logger } from "../lib/logger";
import {
  createWorker,
  DEFAULT_JOB_OPTIONS,
  recurringInvoiceQueue,
  RECURRING_INVOICE_QUEUE,
} from "./queue";

export async function runRecurringInvoiceGeneration(): Promise<void> {
  const orgIds = await organisationRepo.listAllOrgIds();
  const now = new Date();
  let totalGenerated = 0;

  for (const orgId of orgIds) {
    try {
      totalGenerated += await recurringInvoiceService.generateDueInvoices(orgId, now);
    } catch (err) {
      logger.error(
        { orgId, err },
        "Recurring invoice generation failed for org — continuing with the rest of the batch",
      );
    }
  }

  logger.info({ orgCount: orgIds.length, totalGenerated }, "Recurring invoice generation complete");
}

export function startRecurringInvoiceWorker() {
  return createWorker(RECURRING_INVOICE_QUEUE, async () => {
    await runRecurringInvoiceGeneration();
  });
}

// Daily at 06:30 — schedules are per-invoice next_send_date, so a daily sweep
// (not per-schedule cron) is what BRD F-51 actually needs.
export async function scheduleRecurringInvoiceGeneration(): Promise<void> {
  await recurringInvoiceQueue.add(
    "daily-recurring-invoice-generation",
    {},
    {
      ...DEFAULT_JOB_OPTIONS,
      repeat: { pattern: "30 6 * * *" },
      jobId: "daily-recurring-invoice-generation",
    },
  );
}
