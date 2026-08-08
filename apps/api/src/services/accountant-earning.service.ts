import * as accountantEarningRepo from "../repositories/accountant-earning.repository";
import * as referralConversionRepo from "../repositories/referral-conversion.repository";
import { tierForConversionCount, type ReferralTier } from "./referral.service";

// "YYYY-MM", matching accountant-portal.service.ts's currentPeriodLabel().
function monthLabel(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(label: string): { start: Date; end: Date } {
  const [year, month] = label.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year!, month! - 1, 1)),
    end: new Date(Date.UTC(year!, month!, 1)),
  };
}

// The month just completed, relative to `now` — called on the 1st of each
// month (accountant-earnings-generation.job.ts), so "this month" from the
// job's perspective is always the one that just ended.
function previousMonthLabel(now: Date): string {
  return monthLabel(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

export async function generateForOrgAndMonth(orgId: string, month: string): Promise<void> {
  const { start, end } = monthBounds(month);
  const inputs = await accountantEarningRepo.getMonthInputs(orgId, start, end);
  await accountantEarningRepo.upsertMonth(orgId, month, inputs);
}

export async function generatePreviousMonthForAllAccountants(now: Date = new Date()): Promise<{
  orgCount: number;
}> {
  const month = previousMonthLabel(now);
  const orgIds = await accountantEarningRepo.listAccountantOrgIds();
  for (const orgId of orgIds) {
    await generateForOrgAndMonth(orgId, month);
  }
  return { orgCount: orgIds.length };
}

export interface AccountantEarningsSummary {
  tier: ReferralTier;
  lifetimeReferralCount: number;
  monthlyHistory: Array<{
    month: string;
    referredCount: number;
    activeClientCount: number;
    amountOwed: number | null;
  }>;
}

// Tier reuses referral.service.ts's own conversion-count-derived tier
// directly (an accounting firm's org is, for referral purposes, just
// another org with a code) — never recomputed with different thresholds.
export async function getSummary(orgId: string): Promise<AccountantEarningsSummary> {
  const conversions = await referralConversionRepo.listByOrg(orgId);
  const history = await accountantEarningRepo.listByOrg(orgId);

  return {
    tier: tierForConversionCount(conversions.length),
    lifetimeReferralCount: conversions.length,
    monthlyHistory: history.map((h) => ({
      month: h.month,
      referredCount: h.referredCount,
      activeClientCount: h.activeClientCount,
      amountOwed: h.amountOwed === null ? null : Number(h.amountOwed),
    })),
  };
}
