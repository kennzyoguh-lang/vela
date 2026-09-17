import * as saleRepo from "../repositories/sale.repository";
import * as cashCheckRepo from "../repositories/cash-check.repository";
import * as userRepo from "../repositories/user.repository";

export interface StaffLeaderboardEntry {
  staffUserId: string;
  staffName: string;
  salesCount: number;
  salesTotal: number;
  cashChecksCount: number;
  matchedCashChecksCount: number;
  totalShortfall: number; // sum of money missing across every check (always >= 0)
  totalOverage: number; // sum of money over-counted across every check (always >= 0)
}

/**
 * Anti-theft accountability, not just a sales ranking — sales volume and
 * cash-handling accuracy are reported side by side so an owner can spot the
 * pattern a sales-only leaderboard would hide: a top seller whose cash
 * count is frequently short is a different problem than a top seller whose
 * count always matches. Deliberately no single blended "score" — combining
 * money-earned and money-missing into one number would let a large-enough
 * sales total mask a real shortfall pattern, exactly backwards for an
 * anti-theft tool.
 */
export async function getLeaderboard(
  orgId: string,
  from: Date,
  to: Date,
): Promise<StaffLeaderboardEntry[]> {
  const [salesStats, cashChecks, users] = await Promise.all([
    saleRepo.getStatsByStaff(orgId, from, to),
    cashCheckRepo.listByOrgAndRange(orgId, from, to),
    userRepo.listByOrg(orgId),
  ]);

  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const entries = new Map<string, StaffLeaderboardEntry>();

  function entryFor(staffUserId: string): StaffLeaderboardEntry {
    let entry = entries.get(staffUserId);
    if (!entry) {
      entry = {
        staffUserId,
        staffName: nameById.get(staffUserId) ?? "Former staff member",
        salesCount: 0,
        salesTotal: 0,
        cashChecksCount: 0,
        matchedCashChecksCount: 0,
        totalShortfall: 0,
        totalOverage: 0,
      };
      entries.set(staffUserId, entry);
    }
    return entry;
  }

  for (const stat of salesStats) {
    const entry = entryFor(stat.staffUserId);
    entry.salesCount = stat.count;
    entry.salesTotal = stat.total;
  }

  for (const check of cashChecks) {
    const entry = entryFor(check.staffUserId);
    entry.cashChecksCount++;
    if (check.matched) {
      entry.matchedCashChecksCount++;
    } else {
      const difference = Number(check.difference);
      if (difference < 0) entry.totalShortfall += Math.abs(difference);
      else entry.totalOverage += difference;
    }
  }

  return Array.from(entries.values()).sort((a, b) => b.salesTotal - a.salesTotal);
}
