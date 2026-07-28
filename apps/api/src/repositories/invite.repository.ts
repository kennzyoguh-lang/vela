import { withOrgScope } from "../lib/prisma";
import type { OrganisationInvite, Role } from "@prisma/client";

export async function createInvite(
  orgId: string,
  input: { email: string; role: Role; invitedBy: string; expiresAt: Date },
): Promise<OrganisationInvite> {
  return withOrgScope(orgId, (tx) =>
    tx.organisationInvite.create({
      data: {
        orgId,
        email: input.email,
        role: input.role,
        invitedBy: input.invitedBy,
        expiresAt: input.expiresAt,
      },
    }),
  );
}

export async function listPendingForOrg(orgId: string): Promise<OrganisationInvite[]> {
  return withOrgScope(orgId, (tx) =>
    tx.organisationInvite.findMany({
      where: { orgId, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function findById(
  orgId: string,
  inviteId: string,
): Promise<OrganisationInvite | null> {
  return withOrgScope(orgId, (tx) =>
    tx.organisationInvite.findFirst({ where: { id: inviteId, orgId } }),
  );
}

export async function markStatus(
  orgId: string,
  inviteId: string,
  status: "accepted" | "revoked" | "expired",
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.organisationInvite.update({ where: { id: inviteId, orgId }, data: { status } }),
  );
}
