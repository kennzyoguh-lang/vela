import * as organisationRepo from "../repositories/organisation.repository";
import * as invoiceRiskService from "../services/invoice-risk.service";
import { logger } from "../lib/logger";
import { createWorker, DEFAULT_JOB_OPTIONS, riskScoringQueue, RISK_SCORING_QUEUE } from "./queue";

// Handbook 16.1: risk score is "a slow-changing signal, not a real-time one" —
// recalculated daily, never per-request.
export async function runRiskScoring(): Promise<void> {
  const orgIds = await organisationRepo.listAllOrgIds();
  for (const orgId of orgIds) {
    try {
      await invoiceRiskService.scoreAllOpenInvoices(orgId);
    } catch (err) {
      logger.error(
        { orgId, err },
        "Risk scoring failed for org — continuing with the rest of the batch",
      );
    }
  }
  logger.info({ orgCount: orgIds.length }, "Daily risk scoring complete");
}

export function startRiskScoringWorker() {
  return createWorker(RISK_SCORING_QUEUE, async () => {
    await runRiskScoring();
  });
}

export async function scheduleRiskScoring(): Promise<void> {
  await riskScoringQueue.add(
    "daily-risk-scoring",
    {},
    { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: "0 5 * * *" }, jobId: "daily-risk-scoring" },
  );
}
