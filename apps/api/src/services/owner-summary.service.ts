import * as saleRepo from "../repositories/sale.repository";
import * as cashCheckRepo from "../repositories/cash-check.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { logger } from "../lib/logger";
import { businessDayRange } from "./cash-check.service";

export type SummaryStatus = "matched" | "shortfall" | "overage" | "pending";

export interface OwnerDailySummary {
  salesCount: number;
  expectedAmount: number;
  countedAmount: number | null;
  difference: number | null;
  status: SummaryStatus;
}

export async function getTodaySummary(orgId: string, now: Date): Promise<OwnerDailySummary> {
  const { start, end, businessDate } = businessDayRange(now);
  const [stats, cashCheck] = await Promise.all([
    saleRepo.getDailyStats(orgId, start, end),
    cashCheckRepo.findByOrgAndDate(orgId, businessDate),
  ]);

  if (!cashCheck) {
    return {
      salesCount: stats.count,
      expectedAmount: stats.total,
      countedAmount: null,
      difference: null,
      status: "pending",
    };
  }

  const difference = Number(cashCheck.difference);
  const status: SummaryStatus =
    difference === 0 ? "matched" : difference < 0 ? "shortfall" : "overage";
  return {
    salesCount: stats.count,
    expectedAmount: stats.total,
    countedAmount: Number(cashCheck.countedAmount),
    difference,
    status,
  };
}

// Mirrors invoice-pdf.service.ts / payslip-pdf.service.ts's local formatMoney
// — no shared currency formatter exists on the API side. Whole-naira, no
// decimals: this feeds a plain-language SMS/WhatsApp-style sentence, not a
// financial document, and the spec's own example ("₦185,000") has none.
function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

/**
 * Plain-language daily summary — Piece 3 spec, verbatim shape: "Today: 42
 * sales, ₦185,000 expected cash, ₦180,000 counted. ₦5,000 short." No jargon,
 * understandable without opening the app. The "pending" and "overage" cases
 * aren't in the spec's one example but have to be handled: a day can end
 * before anyone runs the cash check, and a count can come in over (not just
 * under) expected.
 */
export function composeSummaryMessage(summary: OwnerDailySummary): string {
  const salesPhrase = `${summary.salesCount} sale${summary.salesCount === 1 ? "" : "s"}`;
  const expectedPhrase = `${formatNaira(summary.expectedAmount)} expected cash`;

  if (summary.status === "pending") {
    return `Today: ${salesPhrase}, ${expectedPhrase}. No cash count yet.`;
  }

  const countedPhrase = `${formatNaira(summary.countedAmount as number)} counted`;
  if (summary.status === "matched") {
    return `Today: ${salesPhrase}, ${expectedPhrase}, ${countedPhrase}. All matched.`;
  }

  const diffPhrase = formatNaira(Math.abs(summary.difference as number));
  const diffWord = summary.status === "shortfall" ? "short" : "over";
  return `Today: ${salesPhrase}, ${expectedPhrase}, ${countedPhrase}. ${diffPhrase} ${diffWord}.`;
}

/**
 * WhatsApp/SMS delivery isn't wired up yet — same honestly-a-stub status as
 * reminder.service.ts's email reminders and cash-check.service.ts's mismatch
 * notification. Still does the real work of computing and composing the
 * message, and audit-logs it, ahead of a real provider integration landing.
 */
export async function sendDailySummary(orgId: string, now: Date): Promise<void> {
  const summary = await getTodaySummary(orgId, now);
  const message = composeSummaryMessage(summary);

  logger.info(
    { orgId, message, status: summary.status },
    "[stub] would send WhatsApp/SMS daily summary — provider not yet wired up",
  );

  await auditLogRepo.write({
    orgId,
    action: "owner_summary.sent",
    entityType: "organisation",
    entityId: orgId,
    newValue: { message, status: summary.status },
  });
}
