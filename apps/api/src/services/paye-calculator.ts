// Nigeria's Personal Income Tax, as rewritten by the Nigeria Tax Act 2025
// (effective 1 January 2026) — one documented, testable formula, same
// "start simple, not configurable" precedent as compliance-obligation-
// rules.ts's due-date rules. If the bands or relief formula change again in
// a future Finance Act, this is the one place to update.

interface TaxBand {
  width: number; // Infinity for the top (uncapped) band
  rate: number;
}

// NTA 2025's six bands: 0% up to NGN800,000, then 15/18/21/23/25%.
const TAX_BANDS: TaxBand[] = [
  { width: 800_000, rate: 0 },
  { width: 2_200_000, rate: 0.15 },
  { width: 9_000_000, rate: 0.18 },
  { width: 13_000_000, rate: 0.21 },
  { width: 25_000_000, rate: 0.23 },
  { width: Infinity, rate: 0.25 },
];

const RENT_RELIEF_RATE = 0.2;
const RENT_RELIEF_CAP = 500_000;

/**
 * The NTA 2025 eliminates the Consolidated Relief Allowance entirely and
 * replaces it with rent relief: 20% of annual rent actually paid, capped at
 * NGN500,000. Someone who doesn't rent (or doesn't declare rent paid)
 * simply gets zero relief here — never assumed to be a renter.
 */
export function calculateRentRelief(annualRentPaid: number): number {
  return Math.min(Math.max(0, annualRentPaid) * RENT_RELIEF_RATE, RENT_RELIEF_CAP);
}

/**
 * annualReliefs covers other tax-deductible statutory contributions (pension,
 * NHF) — computed separately by payroll.service.ts and passed in, since this
 * function only owns the tax-band math, not payroll's other calculations.
 * annualRentPaid feeds the rent-relief formula above; defaults to 0 (no
 * relief) for any caller that doesn't have a rent figure to pass.
 */
export function calculateAnnualPaye(
  grossAnnualIncome: number,
  annualReliefs: number,
  annualRentPaid = 0,
): number {
  const gross = Math.max(0, grossAnnualIncome);
  const rentRelief = calculateRentRelief(annualRentPaid);
  const taxableIncome = Math.max(0, gross - rentRelief - Math.max(0, annualReliefs));

  let remaining = taxableIncome;
  let tax = 0;
  for (const band of TAX_BANDS) {
    if (remaining <= 0) break;
    const amountInBand = Math.min(remaining, band.width);
    tax += amountInBand * band.rate;
    remaining -= amountInBand;
  }
  return tax;
}

// Standard approach for consistent monthly withholding: annualize the
// monthly figures, compute annual PAYE, divide by 12 — rather than applying
// the annual bands directly to a monthly figure (which would tax every month
// as if it were the whole year's income).
export function calculateMonthlyPaye(
  grossMonthlyIncome: number,
  monthlyReliefs: number,
  monthlyRentPaid = 0,
): number {
  return (
    calculateAnnualPaye(grossMonthlyIncome * 12, monthlyReliefs * 12, monthlyRentPaid * 12) / 12
  );
}
