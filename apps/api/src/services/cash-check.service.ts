import * as cashCheckRepo from "../repositories/cash-check.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { logger } from "../lib/logger";
import type { PageParams } from "../lib/pagination";

// Deliberate divergence from the rest of the codebase's plain-UTC
// startOfDay convention (compliance-obligation-rules.ts, compliance.service.ts)
// — those deal in filing-deadline dates where the calendar day is a UTC
// bureaucratic date. A cash count is reconciling against a physical till in
// Lagos: "today" has to mean the trader's actual business day, so this uses
// WAT (UTC+1, no DST) instead. Not applying this elsewhere in the app.
const WAT_OFFSET_MS = 60 * 60 * 1000;

/** [start, end) of the WAT business day containing `now`, expressed in UTC instants. */
export function businessDayRange(now: Date): { start: Date; end: Date; businessDate: Date } {
  const watNow = new Date(now.getTime() + WAT_OFFSET_MS);
  const watMidnightUtc = Date.UTC(
    watNow.getUTCFullYear(),
    watNow.getUTCMonth(),
    watNow.getUTCDate(),
  );
  const start = new Date(watMidnightUtc - WAT_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const businessDate = new Date(watMidnightUtc);
  return { start, end, businessDate };
}

export async function getExpectedForToday(orgId: string, now: Date) {
  const { start, end, businessDate } = businessDayRange(now);
  const expectedAmount = await cashCheckRepo.sumCompletedSalesTotal(orgId, start, end);
  return { expectedAmount, businessDate };
}

/**
 * Notification delivery isn't wired up yet (same honestly-a-stub status as
 * reminder.service.ts's email reminders) — this still does the real work of
 * deciding a mismatch needs flagging and audit-logs it so the owner can see
 * it on the dashboard/audit trail today, ahead of a real push/SMS integration.
 */
async function flagMismatchToOwner(
  orgId: string,
  staffUserId: string,
  difference: number,
): Promise<void> {
  logger.info(
    { orgId, staffUserId, difference },
    "[stub] would notify owner of cash check mismatch — push/SMS integration not yet wired up",
  );
}

export async function submitCashCheck(orgId: string, staffUserId: string, countedAmount: number) {
  const now = new Date();
  const { start, end, businessDate } = businessDayRange(now);
  const expectedAmount = await cashCheckRepo.sumCompletedSalesTotal(orgId, start, end);
  // `|| 0` normalizes a possible -0 (e.g. countedAmount 0.3 vs an
  // expectedAmount that floated to 0.30000000000000004) so a true match
  // never stores or returns a signed-zero difference.
  const difference = Math.round((countedAmount - expectedAmount) * 100) / 100 || 0;
  const matched = difference === 0;

  const record = await cashCheckRepo.create(orgId, {
    staffUserId,
    businessDate,
    expectedAmount,
    countedAmount,
    difference,
    matched,
    currency: "NGN",
  });

  await auditLogRepo.write({
    orgId,
    userId: staffUserId,
    action: matched ? "cash_check.matched" : "cash_check.mismatched",
    entityType: "cash_reconciliation",
    entityId: record.id,
    newValue: { expectedAmount, countedAmount, difference },
  });

  if (!matched) {
    await flagMismatchToOwner(orgId, staffUserId, difference);
  }

  return record;
}

export async function listCashChecks(orgId: string, page: PageParams) {
  return cashCheckRepo.listByOrg(orgId, page);
}
