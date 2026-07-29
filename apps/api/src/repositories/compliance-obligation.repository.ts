import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { ComplianceObligationType, OrgComplianceObligation } from "@prisma/client";

export async function listActive(orgId: string): Promise<OrgComplianceObligation[]> {
  return withOrgScope(orgId, (tx) =>
    tx.orgComplianceObligation.findMany({ where: { orgId, isActive: true } }),
  );
}

export async function listAll(orgId: string): Promise<OrgComplianceObligation[]> {
  return withOrgScope(orgId, (tx) => tx.orgComplianceObligation.findMany({ where: { orgId } }));
}

export async function setActive(
  orgId: string,
  obligationType: ComplianceObligationType,
  isActive: boolean,
): Promise<OrgComplianceObligation> {
  return withOrgScope(orgId, (tx) =>
    tx.orgComplianceObligation.upsert({
      where: { orgId_obligationType: { orgId, obligationType } },
      create: { id: randomUUID(), orgId, obligationType, isActive },
      update: { isActive },
    }),
  );
}
