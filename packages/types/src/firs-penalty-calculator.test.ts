import { describe, it, expect } from "vitest";
import { calculateFirsPenalties } from "./firs-penalty-calculator";

const NOW = new Date("2026-08-07T00:00:00Z");

describe("firs-penalty-calculator", () => {
  describe("months-late boundary", () => {
    it("does not count a month until a full month has actually elapsed", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: "2026-07-08", // one day short of a full month
          monthlyVat: 200_000,
          lastWhtRemittedAt: null,
          monthlyWht: 0,
          citLastFiledYear: null,
          monthlyCit: 0,
        },
        NOW,
      );
      expect(result.vat.monthsLate).toBe(0);
      expect(result.vat.filingPenalty).toBe(0);
    });

    it("counts exactly one month late once a full month has elapsed", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: "2026-07-07", // exactly one month before NOW
          monthlyVat: 200_000,
          lastWhtRemittedAt: null,
          monthlyWht: 0,
          citLastFiledYear: null,
          monthlyCit: 0,
        },
        NOW,
      );
      expect(result.vat.monthsLate).toBe(1);
      expect(result.vat.filingPenalty).toBe(50_000); // first month only, no per-month add-on yet
    });

    it("never returns a negative months-late for a filing date in the future", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: "2026-09-07",
          monthlyVat: 200_000,
          lastWhtRemittedAt: null,
          monthlyWht: 0,
          citLastFiledYear: null,
          monthlyCit: 0,
        },
        NOW,
      );
      expect(result.vat.monthsLate).toBe(0);
    });
  });

  describe("VAT", () => {
    it("computes filing + payment penalty across three months late", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: "2026-05-07", // 3 months before NOW
          monthlyVat: 200_000,
          lastWhtRemittedAt: null,
          monthlyWht: 0,
          citLastFiledYear: null,
          monthlyCit: 0,
        },
        NOW,
      );
      // filing: 50,000 + 2*25,000 = 100,000
      // outstanding: 200,000 * 3 = 600,000
      // payment: 600,000*0.10 + 600,000*0.05*(3/12) = 60,000 + 7,500 = 67,500
      expect(result.vat.monthsLate).toBe(3);
      expect(result.vat.filingPenalty).toBe(100_000);
      expect(result.vat.paymentPenalty).toBeCloseTo(67_500, 6);
      expect(result.vat.totalToDate).toBeCloseTo(167_500, 6);
      expect(result.vat.dailyAccrualRate).toBeCloseTo(167_500 / 90, 6);
      expect(result.vat.disclaimer).toBeNull();
    });

    it("projects 30/60/90-day-out totals assuming the obligation stays unfiled", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: "2026-05-07",
          monthlyVat: 200_000,
          lastWhtRemittedAt: null,
          monthlyWht: 0,
          citLastFiledYear: null,
          monthlyCit: 0,
        },
        NOW,
      );
      expect(result.vat.projected30).toBeCloseTo(218_333.333333, 4);
      expect(result.vat.projected60).toBeCloseTo(270_833.333333, 4);
      expect(result.vat.projected90).toBeCloseTo(325_000, 6);
    });

    it("is zero across the board for someone with no VAT filing history entered", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: null,
          monthlyVat: 200_000,
          lastWhtRemittedAt: null,
          monthlyWht: 0,
          citLastFiledYear: null,
          monthlyCit: 0,
        },
        NOW,
      );
      expect(result.vat.totalToDate).toBe(0);
    });
  });

  describe("WHT", () => {
    it("computes filing + non-remittance penalty and always carries a disclaimer", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: null,
          monthlyVat: 0,
          lastWhtRemittedAt: "2026-06-07", // 2 months before NOW
          monthlyWht: 50_000,
          citLastFiledYear: null,
          monthlyCit: 0,
        },
        NOW,
      );
      // filing: 25,000 + 1*5,000 = 30,000
      // outstanding: 50,000*2 = 100,000
      // payment: 100,000*0.10 + 100,000*0.05*(2/12) = 10,000 + 833.333 = 10,833.333
      expect(result.wht.monthsLate).toBe(2);
      expect(result.wht.filingPenalty).toBe(30_000);
      expect(result.wht.paymentPenalty).toBeCloseTo(10_833.333333, 4);
      expect(result.wht.disclaimer).toMatch(/confirm with FIRS/);
    });

    it("still surfaces the disclaimer even when nothing is owed yet", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: null,
          monthlyVat: 0,
          lastWhtRemittedAt: null,
          monthlyWht: 50_000,
          citLastFiledYear: null,
          monthlyCit: 0,
        },
        NOW,
      );
      expect(result.wht.totalToDate).toBe(0);
      expect(result.wht.disclaimer).not.toBeNull();
    });
  });

  describe("CIT", () => {
    it("grants a full year of grace before counting any months late", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: null,
          monthlyVat: 0,
          lastWhtRemittedAt: null,
          monthlyWht: 0,
          citLastFiledYear: 2026,
          monthlyCit: 0,
        },
        NOW,
      );
      expect(result.cit.monthsLate).toBe(0);
      expect(result.cit.filingPenalty).toBe(0);
    });

    it("computes a filing-only penalty (no payment/interest line) with a strong disclaimer", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: null,
          monthlyVat: 0,
          lastWhtRemittedAt: null,
          monthlyWht: 0,
          citLastFiledYear: 2023, // (2026-2023)*12 - 12 = 24 months late
          monthlyCit: 0,
        },
        NOW,
      );
      expect(result.cit.monthsLate).toBe(24);
      expect(result.cit.filingPenalty).toBe(1_250_000); // 100,000 + 23*50,000
      expect(result.cit.paymentPenalty).toBe(0);
      expect(result.cit.disclaimer).toMatch(/disagree by up to 4x/);
    });
  });

  describe("totals and ranking", () => {
    it("sums all three obligations and ranks them by total owed, most urgent first", () => {
      const result = calculateFirsPenalties(
        {
          lastVatFiledAt: "2026-05-07", // biggest total
          monthlyVat: 200_000,
          lastWhtRemittedAt: "2026-06-07", // smaller total
          monthlyWht: 50_000,
          citLastFiledYear: null, // zero
          monthlyCit: 0,
        },
        NOW,
      );
      expect(result.totalPenalty).toBeCloseTo(
        result.vat.totalToDate + result.wht.totalToDate + result.cit.totalToDate,
        6,
      );
      expect(result.rankedByUrgency.map((r) => r.obligation)).toEqual(["vat", "wht", "cit"]);
    });
  });
});
