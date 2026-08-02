import { describe, it, expect } from "vitest";
import { calculateAnnualPaye, calculateMonthlyPaye, calculateRentRelief } from "./paye-calculator";

describe("paye-calculator", () => {
  describe("calculateRentRelief", () => {
    it("is 20% of annual rent paid, below the cap", () => {
      expect(calculateRentRelief(1_000_000)).toBe(200_000);
    });

    it("caps at NGN500,000 regardless of how much rent was paid", () => {
      expect(calculateRentRelief(10_000_000)).toBe(500_000);
    });

    it("is zero for someone who declares no rent paid — never assumed", () => {
      expect(calculateRentRelief(0)).toBe(0);
    });
  });

  describe("calculateAnnualPaye", () => {
    it("returns zero tax for zero income", () => {
      expect(calculateAnnualPaye(0, 0)).toBe(0);
    });

    it("returns zero tax for income fully inside the NGN800,000 0% band", () => {
      expect(calculateAnnualPaye(200_000, 0)).toBe(0);
    });

    it("clamps taxable income to zero when reliefs exceed gross income", () => {
      expect(calculateAnnualPaye(1_000_000, 1_500_000)).toBe(0);
    });

    it("computes tax across the first three bands", () => {
      // gross 5,000,000, no reliefs/rent -> taxable = 5,000,000
      // 800k@0% (0) + 2.2m@15% (330,000) + remaining 2m of the 9m@18% band (360,000) = 690,000
      expect(calculateAnnualPaye(5_000_000, 0)).toBe(690_000);
    });

    it("computes tax reaching into the top, uncapped 25% band", () => {
      // gross 60,000,000, no reliefs/rent -> taxable = 60,000,000
      // 800k@0 (0) + 2.2m@15% (330,000) + 9m@18% (1,620,000) + 13m@21% (2,730,000)
      // + 25m@23% (5,750,000) + remaining 10m@25% (2,500,000) = 12,930,000
      expect(calculateAnnualPaye(60_000_000, 0)).toBe(12_930_000);
    });

    it("treats pension/NHF reliefs as tax-deductible, reducing taxable income", () => {
      const withoutReliefs = calculateAnnualPaye(5_000_000, 0);
      const withReliefs = calculateAnnualPaye(5_000_000, 500_000);
      expect(withReliefs).toBeLessThan(withoutReliefs);
    });

    it("treats declared rent as tax-deductible via the rent-relief formula, reducing tax", () => {
      const withoutRent = calculateAnnualPaye(1_500_000, 0, 0);
      // 3,000,000 of annual rent -> relief capped at 500,000
      const withRent = calculateAnnualPaye(1_500_000, 0, 3_000_000);
      expect(withRent).toBeLessThan(withoutRent);
      expect(withoutRent).toBe(105_000); // taxable 1,500,000: 800k@0 + 700k@15%
      expect(withRent).toBe(30_000); // taxable 1,000,000: 800k@0 + 200k@15%
    });

    it("never returns a negative tax for defensively-invalid negative income", () => {
      expect(calculateAnnualPaye(-500_000, 0)).toBe(0);
    });
  });

  describe("calculateMonthlyPaye", () => {
    it("equals the annualized-then-divided-by-12 figure, not the annual bands applied directly to the monthly amount", () => {
      const grossMonthly = 250_000;
      const monthlyReliefs = 5_000;
      const monthlyRent = 20_000;
      const expected =
        calculateAnnualPaye(grossMonthly * 12, monthlyReliefs * 12, monthlyRent * 12) / 12;
      expect(calculateMonthlyPaye(grossMonthly, monthlyReliefs, monthlyRent)).toBeCloseTo(
        expected,
        6,
      );
    });

    it("returns zero for a monthly income low enough to stay under the annualized 0% band", () => {
      expect(calculateMonthlyPaye(15_000, 0)).toBe(0);
    });
  });
});
