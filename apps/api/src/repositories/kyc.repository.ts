import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { OrganisationKyc } from "@prisma/client";

export async function findByOrg(orgId: string): Promise<OrganisationKyc | null> {
  return withOrgScope(orgId, (tx) => tx.organisationKyc.findFirst({ where: { orgId } }));
}

export async function upsertNin(orgId: string, ninEncrypted: string): Promise<OrganisationKyc> {
  return withOrgScope(orgId, (tx) =>
    tx.organisationKyc.upsert({
      where: { orgId },
      create: { id: randomUUID(), orgId, ninEncrypted, ninSubmittedAt: new Date() },
      update: { ninEncrypted, ninSubmittedAt: new Date(), ninVerifiedAt: null },
    }),
  );
}

export async function upsertBvn(orgId: string, bvnEncrypted: string): Promise<OrganisationKyc> {
  return withOrgScope(orgId, (tx) =>
    tx.organisationKyc.upsert({
      where: { orgId },
      create: { id: randomUUID(), orgId, bvnEncrypted, bvnSubmittedAt: new Date() },
      update: { bvnEncrypted, bvnSubmittedAt: new Date(), bvnVerifiedAt: null },
    }),
  );
}
