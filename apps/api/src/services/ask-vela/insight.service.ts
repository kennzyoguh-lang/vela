import * as invoiceRepo from "../../repositories/invoice.repository";
import * as bankAccountRepo from "../../repositories/bank-account.repository";
import * as complianceService from "../compliance.service";
import * as payrollService from "../payroll.service";

export type InsightKind =
  "overdue_compliance" | "overdue_invoices" | "low_cash" | "upcoming_payroll" | "all_clear";

export interface InsightFact {
  kind: InsightKind;
  priority: number; // lower = surfaced first
  message: string;
}

// Priority order is a documented, tunable business decision — same shape as
// invoice-risk.service.ts's weight ceilings — not a derived statistic. An
// overdue statutory filing risks real penalties, so it always outranks a
// commercial concern like unpaid invoices; low cash is a warning, not yet a
// deadline, so it ranks below both; payroll not yet run only matters once
// the period is underway.
const PRIORITY_OVERDUE_COMPLIANCE = 1;
const PRIORITY_OVERDUE_INVOICES = 2;
const PRIORITY_LOW_CASH = 3;
const PRIORITY_UPCOMING_PAYROLL = 4;
const PRIORITY_ALL_CLEAR = 5;

const LOW_CASH_THRESHOLD_NGN = 100_000;

function currentPeriodLabel(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Pure function — no I/O, deterministic, unit-tested at every priority
 * boundary. Never called with a DB connection in scope; generateInsight
 * below handles gathering the candidate facts.
 */
export function pickTopInsight(facts: InsightFact[]): InsightFact | null {
  if (facts.length === 0) return null;
  return facts.reduce((best, fact) => (fact.priority < best.priority ? fact : best));
}

export async function generateInsight(orgId: string): Promise<InsightFact | null> {
  const now = new Date();
  const facts: InsightFact[] = [];

  const filings = await complianceService.listFilings(orgId);
  const overdueFilings = filings.filter((f) => f.status === "overdue");
  if (overdueFilings.length > 0) {
    facts.push({
      kind: "overdue_compliance",
      priority: PRIORITY_OVERDUE_COMPLIANCE,
      message:
        overdueFilings.length === 1
          ? `Your ${overdueFilings[0]!.periodLabel} ${overdueFilings[0]!.obligationType.toUpperCase()} filing is overdue.`
          : `${overdueFilings.length} compliance filings are overdue.`,
    });
  }

  const overdueInvoices = await invoiceRepo.listOverdue(orgId, now);
  if (overdueInvoices.length > 0) {
    const total = overdueInvoices.reduce((sum, i) => sum + Number(i.total), 0);
    facts.push({
      kind: "overdue_invoices",
      priority: PRIORITY_OVERDUE_INVOICES,
      message: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? " is" : "s are"} overdue, totalling ${total.toLocaleString()}.`,
    });
  }

  const accounts = await bankAccountRepo.listActiveByOrg(orgId);
  if (accounts.length > 0) {
    const cashTotal = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    if (cashTotal < LOW_CASH_THRESHOLD_NGN) {
      facts.push({
        kind: "low_cash",
        priority: PRIORITY_LOW_CASH,
        message: `Cash position is low — ${cashTotal.toLocaleString()} across connected accounts.`,
      });
    }
  }

  const runs = await payrollService.listRuns(orgId);
  const periodLabel = currentPeriodLabel(now);
  const currentRun = runs.find((r) => r.periodLabel === periodLabel);
  if (!currentRun) {
    facts.push({
      kind: "upcoming_payroll",
      priority: PRIORITY_UPCOMING_PAYROLL,
      message: `Payroll hasn't been run yet for ${periodLabel}.`,
    });
  }

  if (facts.length === 0) {
    facts.push({
      kind: "all_clear",
      priority: PRIORITY_ALL_CLEAR,
      message: "You're all caught up — nothing urgent across compliance, invoices, or payroll.",
    });
  }

  return pickTopInsight(facts);
}
