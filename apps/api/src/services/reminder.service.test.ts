import { describe, it, expect } from "vitest";
import { reminderTriggerFor } from "./reminder.service";

function daysFromNow(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

describe("reminder.service — reminderTriggerFor (BRD F-04's fixed sequence)", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("fires due_in_7_days exactly 7 days before due", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, 7) }, now)).toBe("due_in_7_days");
  });

  it("fires due_today exactly on the due date", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, 0) }, now)).toBe("due_today");
  });

  it("fires overdue_3_days exactly 3 days after due", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, -3) }, now)).toBe("overdue_3_days");
  });

  it("fires overdue_7_days exactly 7 days after due", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, -7) }, now)).toBe("overdue_7_days");
  });

  it("does not fire one day off any boundary (6 days before due)", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, 6) }, now)).toBeNull();
  });

  it("does not fire one day off any boundary (8 days overdue)", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, -8) }, now)).toBeNull();
  });

  it("does not fire for an invoice far from any trigger point", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, 20) }, now)).toBeNull();
  });
});
