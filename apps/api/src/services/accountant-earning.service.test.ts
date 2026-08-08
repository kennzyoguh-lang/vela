import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/accountant-earning.repository", () => ({
  listAccountantOrgIds: vi.fn(),
  getMonthInputs: vi.fn(),
  upsertMonth: vi.fn(),
  listByOrg: vi.fn(),
}));
vi.mock("../repositories/referral-conversion.repository", () => ({
  listByOrg: vi.fn(),
}));

import * as accountantEarningRepo from "../repositories/accountant-earning.repository";
import * as referralConversionRepo from "../repositories/referral-conversion.repository";
import * as accountantEarningService from "./accountant-earning.service";

describe("accountant-earning.service#generateForOrgAndMonth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("computes the month's boundaries in UTC and passes them through to the inputs lookup", async () => {
    vi.mocked(accountantEarningRepo.getMonthInputs).mockResolvedValue({
      referredCount: 4,
      activeClientCount: 7,
    });

    await accountantEarningService.generateForOrgAndMonth("org-1", "2026-07");

    expect(accountantEarningRepo.getMonthInputs).toHaveBeenCalledWith(
      "org-1",
      new Date(Date.UTC(2026, 6, 1)),
      new Date(Date.UTC(2026, 7, 1)),
    );
    expect(accountantEarningRepo.upsertMonth).toHaveBeenCalledWith("org-1", "2026-07", {
      referredCount: 4,
      activeClientCount: 7,
    });
  });

  it("rolls over the year boundary correctly (December -> January)", async () => {
    vi.mocked(accountantEarningRepo.getMonthInputs).mockResolvedValue({
      referredCount: 0,
      activeClientCount: 0,
    });

    await accountantEarningService.generateForOrgAndMonth("org-1", "2025-12");

    expect(accountantEarningRepo.getMonthInputs).toHaveBeenCalledWith(
      "org-1",
      new Date(Date.UTC(2025, 11, 1)),
      new Date(Date.UTC(2026, 0, 1)),
    );
  });
});

describe("accountant-earning.service#generatePreviousMonthForAllAccountants", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates the just-completed month for every accountant org", async () => {
    vi.mocked(accountantEarningRepo.listAccountantOrgIds).mockResolvedValue(["org-1", "org-2"]);
    vi.mocked(accountantEarningRepo.getMonthInputs).mockResolvedValue({
      referredCount: 1,
      activeClientCount: 2,
    });

    // Job runs on Aug 1 — the "just completed" month is July.
    const result = await accountantEarningService.generatePreviousMonthForAllAccountants(
      new Date(Date.UTC(2026, 7, 1)),
    );

    expect(result.orgCount).toBe(2);
    expect(accountantEarningRepo.upsertMonth).toHaveBeenCalledWith(
      "org-1",
      "2026-07",
      expect.anything(),
    );
    expect(accountantEarningRepo.upsertMonth).toHaveBeenCalledWith(
      "org-2",
      "2026-07",
      expect.anything(),
    );
  });
});

describe("accountant-earning.service#getSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("derives the tier from the lifetime referral count, never from a stored value", async () => {
    vi.mocked(referralConversionRepo.listByOrg).mockResolvedValue(
      Array.from({ length: 10 }, () => ({ rewardDescription: "x" })) as never,
    );
    vi.mocked(accountantEarningRepo.listByOrg).mockResolvedValue([
      {
        month: "2026-07",
        referredCount: 3,
        activeClientCount: 5,
        amountOwed: null,
      },
    ] as never);

    const summary = await accountantEarningService.getSummary("org-1");

    expect(summary.tier).toBe("gold"); // 10 conversions -> gold per referral.service.ts thresholds
    expect(summary.lifetimeReferralCount).toBe(10);
    expect(summary.monthlyHistory).toEqual([
      { month: "2026-07", referredCount: 3, activeClientCount: 5, amountOwed: null },
    ]);
  });
});
