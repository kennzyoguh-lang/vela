import * as accountantEarningService from "../services/accountant-earning.service";
import { logger } from "../lib/logger";
import {
  createWorker,
  DEFAULT_JOB_OPTIONS,
  accountantEarningsGenerationQueue,
  ACCOUNTANT_EARNINGS_GENERATION_QUEUE,
} from "./queue";

export async function runAccountantEarningsGeneration(): Promise<void> {
  const { orgCount } = await accountantEarningService.generatePreviousMonthForAllAccountants();
  logger.info({ orgCount }, "Accountant earnings generation complete");
}

export function startAccountantEarningsGenerationWorker() {
  return createWorker(ACCOUNTANT_EARNINGS_GENERATION_QUEUE, async () => {
    await runAccountantEarningsGeneration();
  });
}

// Monthly at 05:00 UTC on the 1st — ahead of the daily 06:00/06:30/07:00
// system-wide scans so it doesn't contend with them for the same minute,
// and after midnight so the previous month has genuinely, fully ended.
export async function scheduleAccountantEarningsGeneration(): Promise<void> {
  await accountantEarningsGenerationQueue.add(
    "monthly-accountant-earnings-generation",
    {},
    {
      ...DEFAULT_JOB_OPTIONS,
      repeat: { pattern: "0 5 1 * *" },
      jobId: "monthly-accountant-earnings-generation",
    },
  );
}
