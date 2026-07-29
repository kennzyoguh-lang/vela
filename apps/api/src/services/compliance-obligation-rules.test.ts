import { describe, it, expect } from "vitest";
import { OBLIGATION_RULES } from "./compliance-obligation-rules";

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

describe("compliance-obligation-rules", () => {
  describe("vat (monthly, due 21st, one-month-back period)", () => {
    it("rolls to this month's 21st when asked before it", () => {
      const { dueDate, periodLabel } = OBLIGATION_RULES.vat.nextOccurrence(utc(2026, 7, 1)); // Aug 1
      expect(dueDate).toEqual(utc(2026, 7, 21));
      expect(periodLabel).toBe("2026-07");
    });

    it("stays on the due day itself (boundary — due today is still valid, not yet rolled)", () => {
      const { dueDate, periodLabel } = OBLIGATION_RULES.vat.nextOccurrence(utc(2026, 7, 21)); // Aug 21
      expect(dueDate).toEqual(utc(2026, 7, 21));
      expect(periodLabel).toBe("2026-07");
    });

    it("rolls to next month's 21st the day after this month's due date", () => {
      const { dueDate, periodLabel } = OBLIGATION_RULES.vat.nextOccurrence(utc(2026, 7, 22)); // Aug 22
      expect(dueDate).toEqual(utc(2026, 8, 21));
      expect(periodLabel).toBe("2026-08");
    });

    it("rolls across a year boundary", () => {
      const { dueDate, periodLabel } = OBLIGATION_RULES.vat.nextOccurrence(utc(2026, 11, 22)); // Dec 22
      expect(dueDate).toEqual(utc(2027, 0, 21));
      expect(periodLabel).toBe("2026-12");
    });
  });

  describe("paye (monthly, due 10th)", () => {
    it("uses the 10th, not VAT's 21st", () => {
      const { dueDate } = OBLIGATION_RULES.paye.nextOccurrence(utc(2026, 7, 1));
      expect(dueDate).toEqual(utc(2026, 7, 10));
    });
  });

  describe("pension (monthly, due 7th)", () => {
    it("uses the 7th", () => {
      const { dueDate } = OBLIGATION_RULES.pension.nextOccurrence(utc(2026, 7, 1));
      expect(dueDate).toEqual(utc(2026, 7, 7));
    });
  });

  describe("cit (annual, due June 30, prior-year period)", () => {
    it("rolls to this year's June 30 when asked from earlier in the year", () => {
      const { dueDate, periodLabel } = OBLIGATION_RULES.cit.nextOccurrence(utc(2026, 0, 1));
      expect(dueDate).toEqual(utc(2026, 5, 30));
      expect(periodLabel).toBe("FY2025");
    });

    it("rolls to next year's June 30 once this year's has passed", () => {
      const { dueDate, periodLabel } = OBLIGATION_RULES.cit.nextOccurrence(utc(2026, 6, 1)); // July 1
      expect(dueDate).toEqual(utc(2027, 5, 30));
      expect(periodLabel).toBe("FY2026");
    });
  });

  describe("cac_annual_return (annual, due March 31, prior-year period)", () => {
    it("rolls to this year's March 31 when asked from earlier in the year", () => {
      const { dueDate, periodLabel } = OBLIGATION_RULES.cac_annual_return.nextOccurrence(
        utc(2026, 0, 1),
      );
      expect(dueDate).toEqual(utc(2026, 2, 31));
      expect(periodLabel).toBe("FY2025");
    });

    it("rolls to next year's March 31 once this year's has passed", () => {
      const { dueDate, periodLabel } = OBLIGATION_RULES.cac_annual_return.nextOccurrence(
        utc(2026, 3, 1), // April 1
      );
      expect(dueDate).toEqual(utc(2027, 2, 31));
      expect(periodLabel).toBe("FY2026");
    });
  });
});
