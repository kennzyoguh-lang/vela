import { describe, it, expect } from "vitest";
import { calculateRiskScore, riskBand } from "./invoice-risk.service";

describe("invoice-risk.service", () => {
  describe("riskBand — boundary values (Design System 4.25's Low/Medium/High scale)", () => {
    it("scores exactly 33 as low", () => {
      expect(riskBand(33)).toBe("low");
    });
    it("scores exactly 34 as medium", () => {
      expect(riskBand(34)).toBe("medium");
    });
    it("scores exactly 66 as medium", () => {
      expect(riskBand(66)).toBe("medium");
    });
    it("scores exactly 67 as high", () => {
      expect(riskBand(67)).toBe("high");
    });
  });

  describe("calculateRiskScore", () => {
    it("returns 0 for a brand-new, on-time, small invoice with a known-reliable client", () => {
      const score = calculateRiskScore({ avgPaymentDays: 0, daysOutstanding: 0, amount: 0 });
      expect(score).toBe(0);
    });

    it("returns 100 when every factor is at or past its normalization ceiling", () => {
      const score = calculateRiskScore({
        avgPaymentDays: 30,
        daysOutstanding: 14,
        amount: 1_000_000,
      });
      expect(score).toBe(100);
    });

    it("treats a client with no payment history as neutral (30), not zero-risk", () => {
      const score = calculateRiskScore({ avgPaymentDays: null, daysOutstanding: 0, amount: 0 });
      expect(score).toBe(30);
    });

    it("clamps avgPaymentDays beyond the normalization ceiling instead of exceeding the factor's weight", () => {
      const score = calculateRiskScore({ avgPaymentDays: 90, daysOutstanding: 0, amount: 0 });
      expect(score).toBe(60); // PAYMENT_HISTORY_MAX, not 180
    });

    it("clamps amount beyond the large-invoice threshold instead of exceeding the factor's weight", () => {
      const score = calculateRiskScore({
        avgPaymentDays: 0,
        daysOutstanding: 0,
        amount: 5_000_000,
      });
      expect(score).toBe(15); // AMOUNT_MAX, not 75
    });

    it("never returns a negative score for defensively-invalid negative inputs", () => {
      const score = calculateRiskScore({ avgPaymentDays: -10, daysOutstanding: -5, amount: -100 });
      expect(score).toBe(0);
    });
  });
});
