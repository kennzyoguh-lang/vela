import { describe, it, expect } from "vitest";
import { pickTopInsight, type InsightFact } from "./insight.service";

function fact(kind: InsightFact["kind"], priority: number): InsightFact {
  return { kind, priority, message: kind };
}

describe("insight.service", () => {
  describe("pickTopInsight — priority boundaries", () => {
    it("returns null when there are no facts", () => {
      expect(pickTopInsight([])).toBeNull();
    });

    it("returns the only fact when there is exactly one", () => {
      const only = fact("all_clear", 5);
      expect(pickTopInsight([only])).toBe(only);
    });

    it("overdue compliance (priority 1) outranks overdue invoices (priority 2)", () => {
      const compliance = fact("overdue_compliance", 1);
      const invoices = fact("overdue_invoices", 2);
      expect(pickTopInsight([invoices, compliance])).toBe(compliance);
    });

    it("overdue invoices (priority 2) outranks low cash (priority 3)", () => {
      const invoices = fact("overdue_invoices", 2);
      const lowCash = fact("low_cash", 3);
      expect(pickTopInsight([lowCash, invoices])).toBe(invoices);
    });

    it("low cash (priority 3) outranks upcoming payroll (priority 4)", () => {
      const lowCash = fact("low_cash", 3);
      const payroll = fact("upcoming_payroll", 4);
      expect(pickTopInsight([payroll, lowCash])).toBe(lowCash);
    });

    it("upcoming payroll (priority 4) outranks the all-clear fallback (priority 5)", () => {
      const payroll = fact("upcoming_payroll", 4);
      const allClear = fact("all_clear", 5);
      expect(pickTopInsight([allClear, payroll])).toBe(payroll);
    });

    it("picks the single highest-priority fact out of a full mixed set, order-independent", () => {
      const facts = [
        fact("all_clear", 5),
        fact("upcoming_payroll", 4),
        fact("overdue_compliance", 1),
        fact("low_cash", 3),
        fact("overdue_invoices", 2),
      ];
      expect(pickTopInsight(facts)!.kind).toBe("overdue_compliance");
      expect(pickTopInsight([...facts].reverse())!.kind).toBe("overdue_compliance");
    });
  });
});
