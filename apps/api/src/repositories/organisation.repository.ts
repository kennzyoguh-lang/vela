import { randomUUID } from "node:crypto";
import { prisma, withOrgScope } from "../lib/prisma";
import type { Organisation } from "@prisma/client";

/**
 * Org creation is the one repository method that legitimately has no orgId to
 * scope by going in — but it still runs inside withOrgScope, using the new
 * org's own pre-generated id. This isn't cosmetic: Postgres's INSERT...RETURNING
 * (which Prisma's `.create()` always does) additionally has to satisfy the
 * table's SELECT policy for the row being returned. Inserting via the
 * unscoped client with no app.current_org_id set fails that check with
 * "new row violates row-level security policy", even though the INSERT
 * policy's own WITH CHECK is unconditionally true — this was caught as a real
 * bug during Foundation verification (it would have broken every signup).
 */
export async function createOrganisation(input: {
  name: string;
  country: string;
  referredByOrgId?: string | null;
  referredByCodeId?: string | null;
}): Promise<Organisation> {
  const id = randomUUID();
  return withOrgScope(id, (tx) =>
    tx.organisation.create({
      data: {
        id,
        name: input.name,
        country: input.country,
        referredByOrgId: input.referredByOrgId ?? null,
        referredByCodeId: input.referredByCodeId ?? null,
      },
    }),
  );
}

export async function findOrganisationById(orgId: string): Promise<Organisation | null> {
  return withOrgScope(orgId, (tx) => tx.organisation.findUnique({ where: { id: orgId } }));
}

/**
 * System-level enumeration for background jobs ONLY (Handbook 5.8) — never
 * call this from a controller or anything reachable by a user request. Goes
 * through the list_all_org_ids() SECURITY DEFINER function (migrations/
 * 20260729010400) since a plain SELECT across organisations is exactly what
 * RLS exists to deny. Returns ids only; every job still uses
 * withOrgScope(orgId, ...) for each org's actual data.
 */
export async function listAllOrgIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT * FROM list_all_org_ids()`;
  return rows.map((r) => r.id);
}

export async function setOrganisationOwner(orgId: string, ownerId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.organisation.update({ where: { id: orgId }, data: { ownerId } }),
  );
}

// Anti-theft Piece 4's discount-approval guardrail — one PIN per org, not
// per-user (see schema.prisma's Organisation.discountApprovalPinHash comment).
export async function setDiscountApprovalPinHash(orgId: string, hash: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.organisation.update({ where: { id: orgId }, data: { discountApprovalPinHash: hash } }),
  );
}

// Business profiling — the three onboarding factors, set together (they're
// answered as one short flow). Also stamps profileFactorsConfirmedAt so a
// deliberate "unsure" to all three is recorded as a completed onboarding,
// distinct from never having answered at all.
export async function setBusinessProfileFactors(
  orgId: string,
  factors: {
    customerPattern: "one_time" | "repeat" | "unsure";
    hasSalesStaff: "yes" | "no" | "unsure";
    isCacRegistered: "yes" | "no" | "unsure";
  },
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.organisation.update({
      where: { id: orgId },
      data: { ...factors, profileFactorsConfirmedAt: new Date() },
    }),
  );
}

// Nigeria Tax Act 2025's "small company" status inputs (tax-status.service.ts)
// — set together since they're answered as one short form, same precedent
// as setBusinessProfileFactors above. Each stays null until the owner
// supplies it; never defaulted to a guessed value.
export async function setTaxProfile(
  orgId: string,
  profile: {
    annualTurnover: number | null;
    fixedAssetsValue: number | null;
    providesProfessionalServices: boolean | null;
  },
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.organisation.update({
      where: { id: orgId },
      data: profile,
    }),
  );
}

// A single module's manual override — Requirement 4's "reveal any hidden
// module" (or hide a shown one). `value: null` clears the override,
// reverting that module to its computed default. One key at a time (not a
// bulk replace) so a concurrent toggle of a different module can't clobber
// this one.
export async function setModuleOverride(
  orgId: string,
  moduleKey: string,
  value: boolean | null,
): Promise<Organisation> {
  return withOrgScope(orgId, async (tx) => {
    const org = await tx.organisation.findUniqueOrThrow({ where: { id: orgId } });
    const overrides = { ...(org.moduleOverrides as Record<string, boolean>) };
    if (value === null) {
      delete overrides[moduleKey];
    } else {
      overrides[moduleKey] = value;
    }
    return tx.organisation.update({
      where: { id: orgId },
      data: { moduleOverrides: overrides },
    });
  });
}
