import { randomUUID } from "node:crypto";
import { prisma, withOrgScope } from "../lib/prisma";
import type { ReferralCode } from "@prisma/client";

export async function findByOrg(orgId: string): Promise<ReferralCode | null> {
  return withOrgScope(orgId, (tx) => tx.referralCode.findFirst({ where: { orgId } }));
}

// No DB-level unique(orgId) constraint — "one code per org" is enforced by
// referral.service.ts calling findByOrg first and only creating when none
// exists. A genuinely concurrent double-click could in theory create two
// codes for the same org; low-stakes enough for a marketing feature that
// this isn't worth a second migration for.
export async function create(orgId: string, code: string): Promise<ReferralCode> {
  return withOrgScope(orgId, (tx) =>
    tx.referralCode.create({ data: { id: randomUUID(), orgId, code } }),
  );
}

// No org context yet — the caller is either an anonymous /refer/[code]
// visitor or the signup flow before any org exists. Goes through the
// resolve_referral_code() SECURITY DEFINER function (migration
// 20260807120000), same two-step shape as
// invoice.repository.ts#findByPaymentPortalToken.
export async function resolveCode(code: string): Promise<{ orgId: string; codeId: string } | null> {
  const rows = await prisma.$queryRaw<{ org_id: string; code_id: string }[]>`
    SELECT * FROM resolve_referral_code(${code})
  `;
  const row = rows[0];
  if (!row?.org_id) return null;
  return { orgId: row.org_id, codeId: row.code_id };
}
