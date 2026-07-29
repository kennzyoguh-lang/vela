import * as organisationRepo from "../repositories/organisation.repository";
import * as complianceService from "../services/compliance.service";
import { logger } from "../lib/logger";
import {
  createWorker,
  DEFAULT_JOB_OPTIONS,
  complianceFilingGenerationQueue,
  COMPLIANCE_FILING_GENERATION_QUEUE,
} from "./queue";

export async function runComplianceFilingGeneration(): Promise<void> {
  const orgIds = await organisationRepo.listAllOrgIds();
  const now = new Date();

  for (const orgId of orgIds) {
    try {
      await complianceService.generateUpcomingFilings(orgId, now);
    } catch (err) {
      logger.error(
        { orgId, err },
        "Compliance filing generation failed for org — continuing with the rest of the batch",
      );
    }
  }

  logger.info({ orgCount: orgIds.length }, "Compliance filing generation complete");
}

export function startComplianceFilingGenerationWorker() {
  return createWorker(COMPLIANCE_FILING_GENERATION_QUEUE, async () => {
    await runComplianceFilingGeneration();
  });
}

// Daily at 06:00 — ahead of recurring invoices (06:30) and reminders (07:00)
// so the system-wide scans don't contend for the same minute.
export async function scheduleComplianceFilingGeneration(): Promise<void> {
  await complianceFilingGenerationQueue.add(
    "daily-compliance-filing-generation",
    {},
    {
      ...DEFAULT_JOB_OPTIONS,
      repeat: { pattern: "0 6 * * *" },
      jobId: "daily-compliance-filing-generation",
    },
  );
}
