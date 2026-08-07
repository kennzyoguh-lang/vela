import type { Job } from "bullmq";
import * as emailGateway from "../services/email/email.gateway";
import { nurtureDay0Email } from "../email/templates/nurture-day0";
import { nurtureDay3Email } from "../email/templates/nurture-day3";
import { nurtureDay7Email } from "../email/templates/nurture-day7";
import { logger } from "../lib/logger";
import { createWorker, DEFAULT_JOB_OPTIONS, nurtureEmailQueue, NURTURE_EMAIL_QUEUE } from "./queue";

const DAY_MS = 24 * 60 * 60 * 1000;

export type NurtureDay = "day0" | "day3" | "day7";

export interface NurtureEmailJobData {
  signupId: string;
  email: string;
  ownerName: string;
  segment: "tier_0" | "mid_market";
  day: NurtureDay;
}

const TEMPLATE_FOR_DAY: Record<NurtureDay, typeof nurtureDay0Email> = {
  day0: nurtureDay0Email,
  day3: nurtureDay3Email,
  day7: nurtureDay7Email,
};

export async function runNurtureEmailJob(data: NurtureEmailJobData): Promise<void> {
  const { subject, html, text } = TEMPLATE_FOR_DAY[data.day](data.segment, data.ownerName);
  await emailGateway.sendEmail(data.email, subject, text, html);
}

export function startNurtureEmailWorker() {
  return createWorker<NurtureEmailJobData>(
    NURTURE_EMAIL_QUEUE,
    async (job: Job<NurtureEmailJobData>) => {
      await runNurtureEmailJob(job.data);
    },
  );
}

/**
 * Called once, at waitlist-join time (waitlist.service.ts#join) — unlike
 * every other job in this codebase (a single repeating cron scanning all
 * orgs), this schedules three PER-SIGNUP delayed jobs via BullMQ's native
 * `delay` option: day0 fires immediately, day3/day7 are genuinely deferred.
 * Each gets a deterministic jobId (`nurture-{signupId}-{day}`) so a retried
 * call to this function (e.g. an idempotent replay) never double-schedules
 * the same email — BullMQ silently no-ops an add() with a jobId that's
 * already present in the queue.
 */
export async function scheduleNurtureEmails(signup: {
  id: string;
  email: string;
  ownerName: string;
  segment: "tier_0" | "mid_market";
}): Promise<void> {
  const jobs: Array<{ day: NurtureDay; delay: number }> = [
    { day: "day0", delay: 0 },
    { day: "day3", delay: 3 * DAY_MS },
    { day: "day7", delay: 7 * DAY_MS },
  ];

  await Promise.all(
    jobs.map(({ day, delay }) =>
      nurtureEmailQueue.add(
        "nurture-email",
        {
          signupId: signup.id,
          email: signup.email,
          ownerName: signup.ownerName,
          segment: signup.segment,
          day,
        } satisfies NurtureEmailJobData,
        { ...DEFAULT_JOB_OPTIONS, delay, jobId: `nurture-${signup.id}-${day}` },
      ),
    ),
  );

  logger.info({ signupId: signup.id, segment: signup.segment }, "Nurture email sequence scheduled");
}
