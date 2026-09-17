import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/sale.repository", () => ({
  getStatsByStaff: vi.fn(),
}));
vi.mock("../repositories/cash-check.repository", () => ({
  listByOrgAndRange: vi.fn(),
}));
vi.mock("../repositories/user.repository", () => ({
  listByOrg: vi.fn(),
}));

import * as saleRepo from "../repositories/sale.repository";
import * as cashCheckRepo from "../repositories/cash-check.repository";
import * as userRepo from "../repositories/user.repository";
import * as staffLeaderboardService from "./staff-leaderboard.service";

describe("staff-leaderboard.service", () => {
  const orgId = randomUUID();
  const from = new Date("2026-08-01");
  const to = new Date("2026-09-01");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saleRepo.getStatsByStaff).mockResolvedValue([]);
    vi.mocked(cashCheckRepo.listByOrgAndRange).mockResolvedValue([]);
    vi.mocked(userRepo.listByOrg).mockResolvedValue([]);
  });

  it("ranks staff by sales total, highest first", async () => {
    const staffA = randomUUID();
    const staffB = randomUUID();
    vi.mocked(userRepo.listByOrg).mockResolvedValue([
      { id: staffA, name: "Ada" } as never,
      { id: staffB, name: "Bola" } as never,
    ]);
    vi.mocked(saleRepo.getStatsByStaff).mockResolvedValue([
      { staffUserId: staffA, count: 5, total: 50000 },
      { staffUserId: staffB, count: 10, total: 90000 },
    ]);

    const leaderboard = await staffLeaderboardService.getLeaderboard(orgId, from, to);

    expect(leaderboard.map((e) => e.staffUserId)).toEqual([staffB, staffA]);
    expect(leaderboard[0]).toMatchObject({ staffName: "Bola", salesCount: 10, salesTotal: 90000 });
  });

  it("separates shortfall from overage rather than netting them", async () => {
    const staffId = randomUUID();
    vi.mocked(userRepo.listByOrg).mockResolvedValue([{ id: staffId, name: "Chidi" } as never]);
    vi.mocked(cashCheckRepo.listByOrgAndRange).mockResolvedValue([
      { staffUserId: staffId, matched: false, difference: -3000 } as never, // shortfall
      { staffUserId: staffId, matched: false, difference: 1000 } as never, // overage
      { staffUserId: staffId, matched: true, difference: 0 } as never, // matched
    ]);

    const [entry] = await staffLeaderboardService.getLeaderboard(orgId, from, to);

    expect(entry).toMatchObject({
      cashChecksCount: 3,
      matchedCashChecksCount: 1,
      totalShortfall: 3000,
      totalOverage: 1000,
    });
  });

  it("includes a staff member who only did cash checks, with zero sales", async () => {
    const staffId = randomUUID();
    vi.mocked(userRepo.listByOrg).mockResolvedValue([{ id: staffId, name: "Dayo" } as never]);
    vi.mocked(cashCheckRepo.listByOrgAndRange).mockResolvedValue([
      { staffUserId: staffId, matched: true, difference: 0 } as never,
    ]);

    const leaderboard = await staffLeaderboardService.getLeaderboard(orgId, from, to);

    expect(leaderboard).toEqual([
      expect.objectContaining({ staffUserId: staffId, salesCount: 0, salesTotal: 0 }),
    ]);
  });

  it("labels a staff member no longer on the org's user list rather than dropping them", async () => {
    const removedStaffId = randomUUID();
    vi.mocked(userRepo.listByOrg).mockResolvedValue([]); // no longer present
    vi.mocked(saleRepo.getStatsByStaff).mockResolvedValue([
      { staffUserId: removedStaffId, count: 3, total: 15000 },
    ]);

    const [entry] = await staffLeaderboardService.getLeaderboard(orgId, from, to);

    expect(entry?.staffName).toBe("Former staff member");
  });

  it("returns an empty leaderboard when there's no activity at all", async () => {
    const leaderboard = await staffLeaderboardService.getLeaderboard(orgId, from, to);
    expect(leaderboard).toEqual([]);
  });
});
