import * as organisationRepo from "../repositories/organisation.repository";
import * as invoiceService from "../services/invoice.service";
import { logger } from "../lib/logger";
import {
  createWorker,
  DEFAULT_JOB_OPTIONS,
  invoiceOverdueQueue,
  INVOICE_OVERDUE_QUEUE,
} from "./queue";

// Closes a real gap: invoice.service.ts#markOverdue has existed since
// SmartInvoice shipped, fully correct and tested, but nothing ever called
// it on a schedule — an invoice past its due date never actually
// transitioned to "overdue" outside a direct API call. Runs before
// risk-scoring (05:00) so that job sees today's correct statuses.
export async function runInvoiceOverdueScan(): Promise<void> {
  const orgIds = await organisationRepo.listAllOrgIds();
  let totalMarked = 0;
  for (const orgId of orgIds) {
    try {
      totalMarked += await invoiceService.markAllOverdue(orgId);
    } catch (err) {
      logger.error(
        { orgId, err },
        "Invoice overdue scan failed for org — continuing with the rest of the batch",
      );
    }
  }
  logger.info({ orgCount: orgIds.length, totalMarked }, "Daily invoice overdue scan complete");
}

export function startInvoiceOverdueWorker() {
  return createWorker(INVOICE_OVERDUE_QUEUE, async () => {
    await runInvoiceOverdueScan();
  });
}

export async function scheduleInvoiceOverdueScan(): Promise<void> {
  await invoiceOverdueQueue.add(
    "daily-invoice-overdue-scan",
    {},
    {
      ...DEFAULT_JOB_OPTIONS,
      repeat: { pattern: "0 4 * * *" },
      jobId: "daily-invoice-overdue-scan",
    },
  );
}
