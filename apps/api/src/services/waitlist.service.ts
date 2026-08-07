import * as waitlistRepo from "../repositories/waitlist-signup.repository";
import { scheduleNurtureEmails } from "../jobs/nurture-email.job";
import { logger } from "../lib/logger";

export type WaitlistSegment = "tier_0" | "mid_market";

// The one "problem" option that identifies a walk-in/cash-heavy trader —
// every other option routes to mid_market. Computed here, server-side,
// never trusted from the client (same principle as business-profile's
// server-computed status) — this drives which nurture-email copy a signup
// receives.
const TIER_0_PROBLEM = "walk_in_sales_cash_theft";

export function deriveSegment(problem: string): WaitlistSegment {
  return problem === TIER_0_PROBLEM ? "tier_0" : "mid_market";
}

export interface JoinWaitlistInput {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  revenueRange: string;
  problem: string;
}

export async function join(input: JoinWaitlistInput) {
  const segment = deriveSegment(input.problem);
  const signup = await waitlistRepo.createSignup({ ...input, segment });

  // Best-effort, fire-and-forget — never awaited in the request path. The
  // BullMQ connection this goes through (jobs/queue.ts's jobsConnection) is
  // configured with maxRetriesPerRequest: null (required for BullMQ's own
  // blocking commands), which means it retries a failed command FOREVER
  // rather than rejecting. Awaiting this here would let a Redis outage hang
  // every waitlist signup indefinitely; a missed nurture sequence is just a
  // marketing gap, never a reason to fail or stall someone joining the
  // waitlist (same "best-effort side effect" precedent as auth.service.ts's
  // markConverted call).
  scheduleNurtureEmails({
    id: signup.id,
    email: signup.email,
    ownerName: signup.ownerName,
    segment,
  }).catch((err) => {
    logger.error({ signupId: signup.id, err }, "Failed to schedule nurture email sequence");
  });

  return signup;
}
