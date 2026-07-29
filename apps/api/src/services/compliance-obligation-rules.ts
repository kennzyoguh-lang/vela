import type { ComplianceObligationType } from "@prisma/client";

// Read from OBLIGATION_RULES below, never stored on a row (see schema.prisma's
// note by the ComplianceObligationType enum) — a plain type, not a Prisma one.
export type ComplianceFrequency = "monthly" | "annual";

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Monthly obligations are due on a fixed day of the month, filed for the
 * PRECEDING calendar month (e.g. a due date of Aug 21 covers July's period).
 * Returns the next occurrence at or after `from`.
 */
function monthlyOccurrence(from: Date, dueDay: number): { dueDate: Date; periodLabel: string } {
  const today = startOfDay(from);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  let dueDate = new Date(Date.UTC(year, month, dueDay));
  if (dueDate < today) {
    dueDate = new Date(Date.UTC(year, month + 1, dueDay));
  }
  const periodDate = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() - 1, 1));
  const periodLabel = `${periodDate.getUTCFullYear()}-${String(periodDate.getUTCMonth() + 1).padStart(2, "0")}`;
  return { dueDate, periodLabel };
}

/**
 * Annual obligations are due on a fixed calendar date, filed for the calendar
 * year that just ended (e.g. a due date of 30 June 2027 covers FY2026).
 *
 * SIMPLIFICATION (documented, not hidden): the real due dates for CIT (6
 * months after financial year-end) and CAC's annual return (42 days after
 * the incorporation anniversary) depend on data VELA doesn't capture yet —
 * a company's fiscal year-end and incorporation date. Both are approximated
 * here with a single fixed calendar-year anchor, assuming the common
 * Jan–Dec fiscal year. Once Organisation gains real fiscal-year-end /
 * incorporation-date fields, these two rules should read from them instead.
 */
function annualOccurrence(
  from: Date,
  dueMonth: number, // 0-indexed
  dueDay: number,
): { dueDate: Date; periodLabel: string } {
  const today = startOfDay(from);
  const year = today.getUTCFullYear();
  let dueDate = new Date(Date.UTC(year, dueMonth, dueDay));
  if (dueDate < today) {
    dueDate = new Date(Date.UTC(year + 1, dueMonth, dueDay));
  }
  const periodLabel = `FY${dueDate.getUTCFullYear() - 1}`;
  return { dueDate, periodLabel };
}

export interface ComplianceObligationRule {
  type: ComplianceObligationType;
  label: string;
  authority: string;
  frequency: ComplianceFrequency;
  description: string;
  nextOccurrence(from: Date): { dueDate: Date; periodLabel: string };
}

// The single place Nigerian filing cadence knowledge lives (mirrors
// invoice-risk.service.ts's "one documented formula" approach). Six
// MUST-priority obligation types — see the Phase 3 plan for what's deferred
// and why (NHF/ITF/NSITF, e-filing API integration, real turnover/fiscal-year
// data).
export const OBLIGATION_RULES: Record<ComplianceObligationType, ComplianceObligationRule> = {
  vat: {
    type: "vat",
    label: "VAT return",
    authority: "FIRS",
    frequency: "monthly",
    description: "Value Added Tax return, due by the 21st of the following month.",
    nextOccurrence: (from) => monthlyOccurrence(from, 21),
  },
  wht: {
    type: "wht",
    label: "Withholding Tax remittance",
    authority: "FIRS",
    frequency: "monthly",
    description: "Withholding Tax on vendor payments, filed alongside VAT by the 21st.",
    nextOccurrence: (from) => monthlyOccurrence(from, 21),
  },
  paye: {
    type: "paye",
    label: "PAYE remittance",
    authority: "State IRS",
    frequency: "monthly",
    description:
      "Pay As You Earn employee income tax remittance, due by the 10th of the following month.",
    nextOccurrence: (from) => monthlyOccurrence(from, 10),
  },
  pension: {
    type: "pension",
    label: "Pension contribution remittance",
    authority: "PenCom",
    frequency: "monthly",
    description:
      "Employer and employee pension contributions, due by the 7th of the following month.",
    nextOccurrence: (from) => monthlyOccurrence(from, 7),
  },
  cit: {
    type: "cit",
    label: "Companies Income Tax",
    authority: "FIRS",
    frequency: "annual",
    description:
      "Annual Companies Income Tax return, due 6 months after financial year-end (assumes a Jan–Dec fiscal year).",
    nextOccurrence: (from) => annualOccurrence(from, 5, 30), // June 30
  },
  cac_annual_return: {
    type: "cac_annual_return",
    label: "CAC Annual Return",
    authority: "CAC",
    frequency: "annual",
    description:
      "Corporate Affairs Commission annual return (approximated to a fixed yearly date until VELA captures incorporation dates).",
    nextOccurrence: (from) => annualOccurrence(from, 2, 31), // March 31
  },
};

export const ALL_OBLIGATION_TYPES = Object.keys(OBLIGATION_RULES) as ComplianceObligationType[];
