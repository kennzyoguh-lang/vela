import { describe, it, expect } from "vitest";
import { categorizeTransaction } from "./transaction-categorization.service";

describe("transaction-categorization.service", () => {
  describe("categorizeTransaction — keyword rules", () => {
    it("matches payroll keywords", () => {
      expect(categorizeTransaction("Staff Salary - July", "debit")).toBe("payroll");
      expect(categorizeTransaction("PAYROLL RUN 2026-07", "debit")).toBe("payroll");
    });

    it("matches rent keywords", () => {
      expect(categorizeTransaction("Office rent payment", "debit")).toBe("rent");
    });

    it("matches utilities keywords", () => {
      expect(categorizeTransaction("NEPA bill settlement", "debit")).toBe("utilities");
      expect(categorizeTransaction("Internet subscription - Spectranet", "debit")).toBe(
        "utilities",
      );
    });

    it("matches marketing keywords", () => {
      expect(categorizeTransaction("Facebook Ads spend", "debit")).toBe("marketing");
    });

    it("matches transport keywords", () => {
      expect(categorizeTransaction("Uber trip 4521", "debit")).toBe("transport");
      expect(categorizeTransaction("Fuel station purchase", "debit")).toBe("transport");
    });

    it("matches transfer keywords", () => {
      expect(categorizeTransaction("Transfer to own savings account", "debit")).toBe("transfer");
    });

    it("matches cost_of_goods keywords", () => {
      expect(categorizeTransaction("Supplier payment - fabric wholesale", "debit")).toBe(
        "cost_of_goods",
      );
    });

    it("is case-insensitive", () => {
      expect(categorizeTransaction("UBER TRIP", "debit")).toBe("transport");
      expect(categorizeTransaction("uber trip", "debit")).toBe("transport");
    });
  });

  describe("categorizeTransaction — no keyword match", () => {
    it("defaults a credit with no keyword match to income", () => {
      expect(categorizeTransaction("Payment from Jane Doe", "credit")).toBe("income");
    });

    it("defaults a debit with no keyword match to uncategorized, not a guess", () => {
      expect(categorizeTransaction("POS Purchase XYZ123", "debit")).toBe("uncategorized");
    });
  });
});
