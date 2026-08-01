import * as cashCheckRepo from "../repositories/cash-check.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as userRepo from "../repositories/user.repository";
import * as smsGateway from "./sms/termii.gateway";
import { logger } from "../lib/logger";
import type { PageParams } from "../lib/pagination";

// Mirrors owner-summary.service.ts's local formatNaira — no shared currency
// formatter exists on the API side (see that file's comment).
function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

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
  const [expectedAmount, existingCheck] = await Promise.all([
    cashCheckRepo.sumCompletedSalesTotal(orgId, start, end),
    cashCheckRepo.findByOrgAndDate(orgId, businessDate),
  ]);
  // `checked` backs the /pos/sell nudge banner (Piece 2 follow-up) — a
  // non-blocking reminder for a business day with sales but no cash check
  // submitted yet, closing the gap where the anti-theft loop is opt-in and
  // silently never gets done.
  return { expectedAmount, businessDate, checked: existingCheck !== null };
}

/**
 * Notifies every owner/admin who's set a notification phone (Settings →
 * Security, organisation.service.ts#setNotificationPhone) via Termii SMS.
 * Attached to submitCashCheck (a staff member finishing their count) rather
 * than a standalone action, so a bad number or provider outage must never
 * block that submission — every send is its own try/catch, and this
 * function itself never throws.
 */
async function flagMismatchToOwner(
  orgId: string,
  staffUserId: string,
  difference: number,
): Promise<void> {
  const phones = await userRepo.findNotifiablePhones(orgId);
  if (phones.length === 0) {
    logger.info(
      { orgId, staffUserId, difference },
      "Cash check mismatch — no owner/admin notification phone configured, nothing sent",
    );
    return;
  }

  const diffWord = difference < 0 ? "short" : "over";
  const message = `Cash check mismatch: ${formatNaira(Math.abs(difference))} ${diffWord} today. Check the app for details.`;

  await Promise.all(
    phones.map(async (phone) => {
      try {
        await smsGateway.sendSms(phone, message);
      } catch (err) {
        logger.error({ err, orgId, phone }, "Failed to send cash check mismatch SMS");
      }
    }),
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
