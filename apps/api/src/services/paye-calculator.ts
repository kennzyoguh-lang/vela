// Nigeria's Personal Income Tax Act (as amended) — one documented, testable
// formula, same "start simple, not configurable" precedent as
// compliance-obligation-rules.ts's due-date rules. If the bands or CRA
// formula change in a future Finance Act, this is the one place to update.

interface TaxBand {
  width: number; // Infinity for the top (uncapped) band
  rate: number;
}

const TAX_BANDS: TaxBand[] = [
  { width: 300_000, rate: 0.07 },
  { width: 300_000, rate: 0.11 },
  { width: 500_000, rate: 0.15 },
  { width: 500_000, rate: 0.19 },
  { width: 1_600_000, rate: 0.21 },
  { width: Infinity, rate: 0.24 },
];

// Consolidated Relief Allowance: the higher of ₦200,000 or 1% of gross
// annual income, plus 20% of gross annual income.
export function calculateConsolidatedReliefAllowance(grossAnnualIncome: number): number {
  return Math.max(200_000, grossAnnualIncome * 0.01) + grossAnnualIncome * 0.2;
}

/**
 * annualReliefs covers other tax-deductible statutory contributions (pension,
 * NHF) — computed separately by payroll.service.ts and passed in, since this
 * function only owns the tax-band math, not payroll's other calculations.
 */
export function calculateAnnualPaye(grossAnnualIncome: number, annualReliefs: number): number {
  const gross = Math.max(0, grossAnnualIncome);
  const cra = calculateConsolidatedReliefAllowance(gross);
  const taxableIncome = Math.max(0, gross - cra - Math.max(0, annualReliefs));

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
export function calculateMonthlyPaye(grossMonthlyIncome: number, monthlyReliefs: number): number {
  return calculateAnnualPaye(grossMonthlyIncome * 12, monthlyReliefs * 12) / 12;
}
