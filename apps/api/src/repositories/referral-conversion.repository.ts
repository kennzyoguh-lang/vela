import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { ReferralConversion } from "@prisma/client";

/**
 * @@unique([refereeOrgId]) on the table is the real idempotency guarantee —
 * a retried or duplicate call for an org that already converted just hits
 * the unique-violation branch and returns false, same "create-and-catch-
 * P2002" precedent as webhook-event.repository.ts#recordIfNew. Scoped under
 * the REFERRER's org (input.orgId), not the referee's — this row belongs to
 * the referrer, who is the one earning the reward.
 */
export async function recordConversion(input: {
  orgId: string;
  refereeOrgId: string;
  referralCodeId: string;
  conversionEvent: string;
  rewardDescription: string;
}): Promise<boolean> {
  try {
    await withOrgScope(input.orgId, (tx) =>
      tx.referralConversion.create({
        data: {
          id: randomUUID(),
          orgId: input.orgId,
          refereeOrgId: input.refereeOrgId,
          referralCodeId: input.referralCodeId,
          conversionEvent: input.conversionEvent,
          convertedAt: new Date(),
          rewardRecordedAt: new Date(),
          rewardDescription: input.rewardDescription,
        },
      }),
    );
    return true;
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return false; // already converted — not an error
    }
    throw err;
  }
}

export async function listByOrg(orgId: string): Promise<ReferralConversion[]> {
  return withOrgScope(orgId, (tx) =>
    tx.referralConversion.findMany({ where: { orgId }, orderBy: { convertedAt: "desc" } }),
  );
}
