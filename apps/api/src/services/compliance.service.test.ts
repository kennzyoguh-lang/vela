import { describe, it, expect } from "vitest";
import { computeFilingStatus } from "./compliance.service";

const DAY = 1000 * 60 * 60 * 24;
const NOW = new Date("2026-08-15T12:00:00.000Z"); // arbitrary anchor, midday to rule out off-by-timezone flakes

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * DAY);
}

describe("compliance.service", () => {
  describe("computeFilingStatus — boundary values", () => {
    it("due exactly today counts as due_soon, not upcoming", () => {
      expect(computeFilingStatus({ dueDate: daysFromNow(0), filedAt: null }, NOW)).toBe("due_soon");
    });

    it("due in exactly 7 days counts as due_soon (inclusive boundary)", () => {
      expect(computeFilingStatus({ dueDate: daysFromNow(7), filedAt: null }, NOW)).toBe("due_soon");
    });

    it("due in exactly 8 days counts as upcoming", () => {
      expect(computeFilingStatus({ dueDate: daysFromNow(8), filedAt: null }, NOW)).toBe("upcoming");
    });

    it("due yesterday counts as overdue", () => {
      expect(computeFilingStatus({ dueDate: daysFromNow(-1), filedAt: null }, NOW)).toBe("overdue");
    });

    it("due far in the past counts as overdue", () => {
      expect(computeFilingStatus({ dueDate: daysFromNow(-90), filedAt: null }, NOW)).toBe(
        "overdue",
      );
    });

    it("filed always wins, even for a filing that was overdue before being filed", () => {
      expect(
        computeFilingStatus({ dueDate: daysFromNow(-30), filedAt: daysFromNow(-1) }, NOW),
      ).toBe("filed");
    });

    it("filed wins even for a filing due far in the future", () => {
      expect(computeFilingStatus({ dueDate: daysFromNow(60), filedAt: daysFromNow(-1) }, NOW)).toBe(
        "filed",
      );
    });
  });
});
