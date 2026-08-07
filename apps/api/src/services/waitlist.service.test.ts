import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/waitlist-signup.repository", () => ({
  createSignup: vi.fn(),
}));
vi.mock("../jobs/nurture-email.job", () => ({
  scheduleNurtureEmails: vi.fn().mockResolvedValue(undefined),
}));

import * as waitlistRepo from "../repositories/waitlist-signup.repository";
import { scheduleNurtureEmails } from "../jobs/nurture-email.job";
import * as waitlistService from "./waitlist.service";
import { deriveSegment } from "./waitlist.service";

describe("waitlist.service#deriveSegment", () => {
  it("is tier_0 for the walk-in-sales/cash-theft problem", () => {
    expect(deriveSegment("walk_in_sales_cash_theft")).toBe("tier_0");
  });

  it("is mid_market for every other problem option", () => {
    expect(deriveSegment("invoicing_late_payments")).toBe("mid_market");
    expect(deriveSegment("compliance_tax_filing")).toBe("mid_market");
    expect(deriveSegment("bookkeeping_cashflow")).toBe("mid_market");
    expect(deriveSegment("other")).toBe("mid_market");
  });
});

describe("waitlist.service#join", () => {
  beforeEach(() => vi.clearAllMocks());

  const input = {
    businessName: "Ada's Textiles",
    ownerName: "Ada",
    email: "ada@example.com",
    phone: null,
    revenueRange: "1m_5m",
    problem: "walk_in_sales_cash_theft",
  };

  it("derives the segment server-side, persists it, and schedules the nurture sequence", async () => {
    vi.mocked(waitlistRepo.createSignup).mockResolvedValue({
      id: "signup-1",
      ...input,
      segment: "tier_0",
      createdAt: new Date(),
    } as never);

    const result = await waitlistService.join(input);

    expect(waitlistRepo.createSignup).toHaveBeenCalledWith({ ...input, segment: "tier_0" });
    expect(scheduleNurtureEmails).toHaveBeenCalledWith({
      id: "signup-1",
      email: "ada@example.com",
      ownerName: "Ada",
      segment: "tier_0",
    });
    expect(result.id).toBe("signup-1");
  });

  it("resolves immediately even if scheduling the nurture sequence fails or never settles — a signup must never hang or fail because of it", async () => {
    vi.mocked(waitlistRepo.createSignup).mockResolvedValue({
      id: "signup-2",
      ...input,
      segment: "tier_0",
      createdAt: new Date(),
    } as never);
    // Simulates a Redis outage: jobs/queue.ts's BullMQ connection is
    // configured with maxRetriesPerRequest: null, so a real failure here
    // would never settle at all — this rejection stands in for that.
    vi.mocked(scheduleNurtureEmails).mockRejectedValueOnce(new Error("redis unreachable"));

    await expect(waitlistService.join(input)).resolves.toMatchObject({ id: "signup-2" });
  });
});
