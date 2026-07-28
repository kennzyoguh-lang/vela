import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
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
}): Promise<Organisation> {
  const id = randomUUID();
  return withOrgScope(id, (tx) =>
    tx.organisation.create({ data: { id, name: input.name, country: input.country } }),
  );
}

export async function findOrganisationById(orgId: string): Promise<Organisation | null> {
  return withOrgScope(orgId, (tx) => tx.organisation.findUnique({ where: { id: orgId } }));
}

export async function setOrganisationOwner(orgId: string, ownerId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.organisation.update({ where: { id: orgId }, data: { ownerId } }),
  );
}
