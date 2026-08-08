import { randomUUID } from "node:crypto";
import { prisma, withOrgScope } from "../lib/prisma";
import type { AccountantEarning } from "@prisma/client";

// Background-job enumeration (Handbook 5.8), same shape as
// organisation.repository.ts#listAllOrgIds — for background jobs ONLY.
export async function listAccountantOrgIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT * FROM list_accountant_org_ids()`;
  return rows.map((r) => r.id);
}

// The month's two raw inputs, computed server-side by
// accountant_earnings_inputs() (migration 20260807130000) — see that
// function's comment for why this is one narrow SECURITY DEFINER read
// rather than two separately-scoped queries.
export async function getMonthInputs(
  orgId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<{ referredCount: number; activeClientCount: number }> {
  const rows = await prisma.$queryRaw<{ referred_count: bigint; active_client_count: bigint }[]>`
    SELECT * FROM accountant_earnings_inputs(${orgId}::uuid, ${monthStart}, ${monthEnd})
  `;
  const row = rows[0];
  return {
    referredCount: Number(row?.referred_count ?? 0),
    activeClientCount: Number(row?.active_client_count ?? 0),
  };
}

export async function upsertMonth(
  orgId: string,
  month: string,
  input: { referredCount: number; activeClientCount: number },
): Promise<AccountantEarning> {
  return withOrgScope(orgId, (tx) =>
    tx.accountantEarning.upsert({
      where: { orgId_month: { orgId, month } },
      create: {
        id: randomUUID(),
        orgId,
        month,
        referredCount: input.referredCount,
        activeClientCount: input.activeClientCount,
      },
      update: {
        referredCount: input.referredCount,
        activeClientCount: input.activeClientCount,
      },
    }),
  );
}

export async function listByOrg(orgId: string): Promise<AccountantEarning[]> {
  return withOrgScope(orgId, (tx) =>
    tx.accountantEarning.findMany({ where: { orgId }, orderBy: { month: "desc" } }),
  );
}
