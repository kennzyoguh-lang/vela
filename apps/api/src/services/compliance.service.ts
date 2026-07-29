import * as obligationRepo from "../repositories/compliance-obligation.repository";
import * as filingRepo from "../repositories/compliance-filing.repository";
import { OBLIGATION_RULES, ALL_OBLIGATION_TYPES } from "./compliance-obligation-rules";
import { NotFoundError } from "../lib/errors";
import type { ComplianceFiling, ComplianceObligationType } from "@prisma/client";

export type FilingStatus = "upcoming" | "due_soon" | "overdue" | "filed";

const DUE_SOON_WINDOW_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Pure function — filing status is derived, never stored (same "derive,
 * don't store" approach as invoice-risk.service.ts's risk band). `filed`
 * takes priority over everything else regardless of how overdue the filing
 * was before it got filed.
 */
export function computeFilingStatus(
  filing: Pick<ComplianceFiling, "dueDate" | "filedAt">,
  now: Date,
): FilingStatus {
  if (filing.filedAt) return "filed";
  const daysUntilDue = Math.round(
    (startOfDay(filing.dueDate).getTime() - startOfDay(now).getTime()) / MS_PER_DAY,
  );
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= DUE_SOON_WINDOW_DAYS) return "due_soon";
  return "upcoming";
}

export async function listObligations(orgId: string) {
  const active = await obligationRepo.listAll(orgId);
  const activeByType = new Map(active.map((o) => [o.obligationType, o]));
  return ALL_OBLIGATION_TYPES.map((type) => ({
    ...OBLIGATION_RULES[type],
    isActive: activeByType.get(type)?.isActive ?? false,
  }));
}

export async function toggleObligation(
  orgId: string,
  obligationType: ComplianceObligationType,
  isActive: boolean,
) {
  const obligation = await obligationRepo.setActive(orgId, obligationType, isActive);
  // Generate this obligation's next filing immediately on enable, rather than
  // waiting for tomorrow's job — the daily job (Epic 3) still runs for every
  // other org and to advance periods forward once one is filed.
  if (isActive) {
    const rule = OBLIGATION_RULES[obligationType];
    const { dueDate, periodLabel } = rule.nextOccurrence(new Date());
    await filingRepo.upsertPeriod(orgId, obligationType, periodLabel, dueDate);
  }
  return obligation;
}

// Attaches the derived status to the response DTO — computed once, server-
// side, so the frontend never re-derives it (and risks drifting from this
// logic, or hitting a clock-boundary mismatch between page-load and refetch).
function withStatus(filing: ComplianceFiling, now: Date) {
  return { ...filing, status: computeFilingStatus(filing, now) };
}

export async function listFilings(orgId: string) {
  const filings = await filingRepo.listByOrg(orgId);
  const now = new Date();
  return filings.map((f) => withStatus(f, now));
}

export async function getFiling(orgId: string, filingId: string) {
  const filing = await filingRepo.findById(orgId, filingId);
  if (!filing) throw new NotFoundError("Filing not found");
  return withStatus(filing, new Date());
}

export async function markFiled(
  orgId: string,
  filingId: string,
  input: { filedAt: Date; receiptReference?: string; notes?: string },
) {
  await getFiling(orgId, filingId); // 404s before attempting the update
  const filing = await filingRepo.markFiled(orgId, filingId, input);
  return withStatus(filing, new Date());
}

/**
 * For each of the org's active obligation types, ensures the next unfilled
 * period's ComplianceFiling row exists. Safe to re-run any time (the
 * repository's upsert makes this idempotent) — called by the daily
 * generation job (Epic 3); `toggleObligation` above also calls it directly
 * for the single obligation just enabled, so the user sees a filing right
 * away instead of waiting for tomorrow's run.
 */
export async function generateUpcomingFilings(orgId: string, now: Date): Promise<void> {
  const active = await obligationRepo.listActive(orgId);
  for (const obligation of active) {
    const rule = OBLIGATION_RULES[obligation.obligationType];
    const { dueDate, periodLabel } = rule.nextOccurrence(now);
    await filingRepo.upsertPeriod(orgId, obligation.obligationType, periodLabel, dueDate);
  }
}
