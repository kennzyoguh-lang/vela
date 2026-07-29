import { describe, it, expect } from "vitest";
import { calculateAnnualPaye, calculateMonthlyPaye } from "./paye-calculator";

describe("paye-calculator", () => {
  describe("calculateAnnualPaye", () => {
    it("returns zero tax for zero income", () => {
      expect(calculateAnnualPaye(0, 0)).toBe(0);
    });

    it("returns zero tax when the Consolidated Relief Allowance absorbs all of a low income", () => {
      // gross 200,000 -> CRA = max(200000, 2000) + 40000 = 240,000 > gross
      expect(calculateAnnualPaye(200_000, 0)).toBe(0);
    });

    it("clamps taxable income to zero when reliefs alone exceed gross minus CRA", () => {
      expect(calculateAnnualPaye(100_000, 50_000)).toBe(0);
    });

    it("computes tax across exactly the first two bands (boundary: taxable income lands exactly on the second band's edge)", () => {
      // gross 1,000,000 -> CRA = max(200000,10000) + 200000 = 400,000
      // taxable = 600,000 -> 300k@7% (21,000) + 300k@11% (33,000) = 54,000
      expect(calculateAnnualPaye(1_000_000, 0)).toBe(54_000);
    });

    it("computes tax reaching into the top, uncapped band", () => {
      // gross 10,000,000 -> CRA = max(200000,100000) + 2,000,000 = 2,200,000
      // taxable = 7,800,000 -> bands sum to 1,664,000 (see paye-calculator.test.ts comment)
      expect(calculateAnnualPaye(10_000_000, 0)).toBe(1_664_000);
    });

    it("treats pension/NHF reliefs as tax-deductible, reducing taxable income", () => {
      const withoutReliefs = calculateAnnualPaye(1_000_000, 0);
      const withReliefs = calculateAnnualPaye(1_000_000, 100_000);
      expect(withReliefs).toBeLessThan(withoutReliefs);
    });

    it("never returns a negative tax for defensively-invalid negative income", () => {
      expect(calculateAnnualPaye(-500_000, 0)).toBe(0);
    });
  });

  describe("calculateMonthlyPaye", () => {
    it("equals the annualized-then-divided-by-12 figure, not the annual bands applied directly to the monthly amount", () => {
      const grossMonthly = 250_000;
      const monthlyReliefs = 5_000;
      const expected = calculateAnnualPaye(grossMonthly * 12, monthlyReliefs * 12) / 12;
      expect(calculateMonthlyPaye(grossMonthly, monthlyReliefs)).toBeCloseTo(expected, 6);
    });

    it("returns zero for a monthly income low enough to stay under the annualized CRA", () => {
      expect(calculateMonthlyPaye(15_000, 0)).toBe(0);
    });
  });
});
