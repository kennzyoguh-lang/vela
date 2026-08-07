// Estimated FIRS penalties for VAT, WHT, and CIT — same "one documented
// formula, disclaim what's uncertain" precedent as paye-calculator.ts and
// tax-status.service.ts. VAT figures were consistent across all three
// sources checked; WHT and CIT carry a visible disclaimer because sources
// partially disagreed on them at the time this was written. This is a lead-
// generation estimate, not a filing system — every result is paired with a
// "confirm with FIRS or your accountant" caveat at the call site.

export interface PenaltyBreakdown {
  monthsLate: number;
  filingPenalty: number;
  paymentPenalty: number;
  totalToDate: number;
  dailyAccrualRate: number;
  projected30: number;
  projected60: number;
  projected90: number;
  disclaimer: string | null;
}

export interface FirsPenaltyInput {
  lastVatFiledAt: string | null;
  monthlyVat: number;
  lastWhtRemittedAt: string | null;
  monthlyWht: number;
  citLastFiledYear: number | null;
  monthlyCit: number;
}

export type FirsObligation = "vat" | "wht" | "cit";

export interface FirsPenaltyResult {
  vat: PenaltyBreakdown;
  wht: PenaltyBreakdown;
  cit: PenaltyBreakdown;
  totalPenalty: number;
  rankedByUrgency: Array<{ obligation: FirsObligation; totalToDate: number }>;
}

// Whole months elapsed from `from` to `to`, floored, never negative. A
// filing due the month after `from` means monthsLate == 0 in the first
// grace month, then grows by one per additional missed month. Uses UTC
// getters throughout because "YYYY-MM-DD" input strings parse as UTC
// midnight — mixing in local-time getters would shift the result by a day
// near the boundary depending on the server's timezone.
function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) -
    (to.getUTCDate() < from.getUTCDate() ? 1 : 0);
  return Math.max(0, months);
}

// Late-filing penalty: a flat first-month charge, then a smaller charge per
// additional month late. Zero for anyone still inside the current period.
function filingPenaltyFor(monthsLate: number, firstMonth: number, perMonth: number): number {
  if (monthsLate <= 0) return 0;
  return firstMonth + (monthsLate - 1) * perMonth;
}

// Late-payment penalty: a one-off percentage of the amount owed, plus
// interest accrued at an annual rate, pro-rated by how long it's been owed.
function paymentPenaltyFor(
  outstanding: number,
  monthsLate: number,
  penaltyRate: number,
  annualInterestRate: number,
): number {
  if (monthsLate <= 0 || outstanding <= 0) return 0;
  return outstanding * penaltyRate + outstanding * annualInterestRate * (monthsLate / 12);
}

function buildBreakdown(params: {
  monthsLate: number;
  monthlyAmount: number;
  filingFirstMonth: number;
  filingPerMonth: number;
  paymentPenaltyRate: number;
  paymentInterestRate: number;
  disclaimer: string | null;
}): PenaltyBreakdown {
  const {
    monthsLate,
    monthlyAmount,
    filingFirstMonth,
    filingPerMonth,
    paymentPenaltyRate,
    paymentInterestRate,
    disclaimer,
  } = params;

  const outstanding = Math.max(0, monthlyAmount) * monthsLate;
  const filingPenalty = filingPenaltyFor(monthsLate, filingFirstMonth, filingPerMonth);
  const paymentPenalty = paymentPenaltyFor(
    outstanding,
    monthsLate,
    paymentPenaltyRate,
    paymentInterestRate,
  );
  const totalToDate = filingPenalty + paymentPenalty;

  // Average daily accrual across the period so far — a display estimate,
  // not a precise day-by-day accrual schedule (filing penalties step
  // monthly, not daily).
  const dailyAccrualRate = monthsLate > 0 ? totalToDate / (monthsLate * 30) : 0;

  const at = (extraMonths: number) => {
    const projectedMonthsLate = monthsLate + extraMonths;
    const projectedOutstanding = Math.max(0, monthlyAmount) * projectedMonthsLate;
    return (
      filingPenaltyFor(projectedMonthsLate, filingFirstMonth, filingPerMonth) +
      paymentPenaltyFor(
        projectedOutstanding,
        projectedMonthsLate,
        paymentPenaltyRate,
        paymentInterestRate,
      )
    );
  };

  return {
    monthsLate,
    filingPenalty,
    paymentPenalty,
    totalToDate,
    dailyAccrualRate,
    projected30: at(1),
    projected60: at(2),
    projected90: at(3),
    disclaimer,
  };
}

export function calculateFirsPenalties(
  input: FirsPenaltyInput,
  now: Date = new Date(),
): FirsPenaltyResult {
  const vatMonthsLate = input.lastVatFiledAt
    ? monthsBetween(new Date(input.lastVatFiledAt), now)
    : 0;
  const vat = buildBreakdown({
    monthsLate: vatMonthsLate,
    monthlyAmount: input.monthlyVat,
    filingFirstMonth: 50_000,
    filingPerMonth: 25_000,
    paymentPenaltyRate: 0.1,
    paymentInterestRate: 0.05,
    disclaimer: null,
  });

  const whtMonthsLate = input.lastWhtRemittedAt
    ? monthsBetween(new Date(input.lastWhtRemittedAt), now)
    : 0;
  const wht = buildBreakdown({
    monthsLate: whtMonthsLate,
    monthlyAmount: input.monthlyWht,
    filingFirstMonth: 25_000,
    filingPerMonth: 5_000,
    paymentPenaltyRate: 0.1,
    paymentInterestRate: 0.05,
    disclaimer:
      "Sources disagree on whether the non-remittance penalty follows this exact formula after the 2025 reform — confirm with FIRS or your accountant.",
  });

  // CIT is an annual filing due the year after the financial year it
  // covers; approximated here as 12 months of grace before penalties
  // start, then one month of "late" per elapsed calendar month after that.
  // Payment/interest penalties for CIT are not estimated — only filing.
  const citMonthsLate = input.citLastFiledYear
    ? Math.max(0, (now.getUTCFullYear() - input.citLastFiledYear) * 12 - 12)
    : 0;
  const cit = buildBreakdown({
    monthsLate: citMonthsLate,
    monthlyAmount: 0,
    filingFirstMonth: 100_000,
    filingPerMonth: 50_000,
    paymentPenaltyRate: 0,
    paymentInterestRate: 0,
    disclaimer:
      "Sources disagree by up to 4x on this figure — confirm your exact CIT penalty with FIRS or your accountant before relying on it.",
  });

  const totalPenalty = vat.totalToDate + wht.totalToDate + cit.totalToDate;
  // Annotated as its own statement, not inline before .sort() — TS doesn't
  // propagate a variable's type annotation through a chained method call
  // back onto the array literal, so "vat"/"wht"/"cit" would otherwise widen
  // to `string` and fail to satisfy FirsObligation.
  const obligationTotals: Array<{ obligation: FirsObligation; totalToDate: number }> = [
    { obligation: "vat", totalToDate: vat.totalToDate },
    { obligation: "wht", totalToDate: wht.totalToDate },
    { obligation: "cit", totalToDate: cit.totalToDate },
  ];
  const rankedByUrgency = obligationTotals.sort((a, b) => b.totalToDate - a.totalToDate);

  return { vat, wht, cit, totalPenalty, rankedByUrgency };
}
