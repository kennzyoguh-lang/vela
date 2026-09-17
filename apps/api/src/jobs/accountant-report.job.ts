import * as accountantReportService from "../services/accountant-report.service";
import { logger } from "../lib/logger";
import {
  createWorker,
  DEFAULT_JOB_OPTIONS,
  accountantReportQueue,
  ACCOUNTANT_REPORT_QUEUE,
} from "./queue";

export async function runAccountantReportScan(): Promise<void> {
  const { linkCount } = await accountantReportService.sendMonthlyReportsForAllAccountants();
  logger.info({ linkCount }, "Monthly accountant report scan complete");
}

export function startAccountantReportWorker() {
  return createWorker(ACCOUNTANT_REPORT_QUEUE, async () => {
    await runAccountantReportScan();
  });
}

// Monthly at 05:30 UTC on the 1st — same day as
// accountant-earnings-generation.job.ts's 05:00 slot, staggered 30 minutes
// so the two monthly batches don't contend with each other, both run after
// midnight so the previous month has genuinely, fully ended.
export async function scheduleAccountantReportScan(): Promise<void> {
  await accountantReportQueue.add(
    "monthly-accountant-report",
    {},
    {
      ...DEFAULT_JOB_OPTIONS,
      repeat: { pattern: "30 5 1 * *" },
      jobId: "monthly-accountant-report",
    },
  );
}
