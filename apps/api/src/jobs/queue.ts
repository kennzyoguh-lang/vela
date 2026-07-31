import { Queue, Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

// BullMQ needs its own Redis connection (maxRetriesPerRequest: null, required
// for its blocking commands) — separate from lib/redis.ts's shared client
// used for rate limiting, even though both point at the same physical Redis
// at Horizon 1 (Handbook 10.5: these split onto separate instances only once
// scale actually demands it, not before).
export const jobsConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const REMINDER_QUEUE = "invoice-reminders";
export const RECURRING_INVOICE_QUEUE = "recurring-invoices";
export const RISK_SCORING_QUEUE = "invoice-risk-scoring";
export const COMPLIANCE_FILING_GENERATION_QUEUE = "compliance-filing-generation";
export const COMPLIANCE_REMINDER_QUEUE = "compliance-reminders";
export const BANK_SYNC_QUEUE = "bank-sync";
export const OWNER_SUMMARY_QUEUE = "owner-daily-summary";

export const reminderQueue = new Queue(REMINDER_QUEUE, { connection: jobsConnection });
export const recurringInvoiceQueue = new Queue(RECURRING_INVOICE_QUEUE, {
  connection: jobsConnection,
});
export const riskScoringQueue = new Queue(RISK_SCORING_QUEUE, { connection: jobsConnection });
export const complianceFilingGenerationQueue = new Queue(COMPLIANCE_FILING_GENERATION_QUEUE, {
  connection: jobsConnection,
});
export const complianceReminderQueue = new Queue(COMPLIANCE_REMINDER_QUEUE, {
  connection: jobsConnection,
});
export const bankSyncQueue = new Queue(BANK_SYNC_QUEUE, { connection: jobsConnection });
export const ownerSummaryQueue = new Queue(OWNER_SUMMARY_QUEUE, { connection: jobsConnection });

// All jobs are idempotent by design (Handbook 5.8) — safe to re-run. Retry
// policy: 3 attempts with exponential backoff, matching the reminder/
// recurring-invoice jobs' "real customer impact if missed" classification.
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 60_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export function createWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
): Worker<T> {
  const worker = new Worker<T>(queueName, processor, {
    connection: jobsConnection,
    concurrency: 5,
  });
  worker.on("failed", (job, err) => {
    logger.error({ queueName, jobId: job?.id, err }, "Job failed");
  });
  return worker;
}
