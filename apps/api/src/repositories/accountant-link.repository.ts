import { randomUUID } from "node:crypto";
import { prisma, withOrgScope } from "../lib/prisma";
import type { AccountantClientLink, AccountantLinkStatus } from "@prisma/client";

export async function findByEmail(
  orgId: string,
  email: string,
): Promise<AccountantClientLink | null> {
  return withOrgScope(orgId, (tx) =>
    tx.accountantClientLink.findFirst({ where: { orgId, accountantEmail: email } }),
  );
}

export async function create(
  orgId: string,
  input: { accountantEmail: string; invitedBy: string },
): Promise<AccountantClientLink> {
  return withOrgScope(orgId, (tx) =>
    tx.accountantClientLink.create({
      data: {
        id: randomUUID(),
        orgId,
        accountantEmail: input.accountantEmail,
        invitedBy: input.invitedBy,
      },
    }),
  );
}

// Re-invites a previously-revoked link by resetting it to pending, rather
// than inserting a second row — @@unique([orgId, accountantEmail]) means
// there is only ever one relationship record per (org, email) pair, which
// transitions through states rather than accumulating history rows.
export async function reinvite(
  orgId: string,
  linkId: string,
  invitedBy: string,
): Promise<AccountantClientLink> {
  return withOrgScope(orgId, (tx) =>
    tx.accountantClientLink.update({
      where: { id: linkId, orgId },
      data: {
        status: "pending",
        accountantUserId: null,
        invitedBy,
        invitedAt: new Date(),
        respondedAt: null,
        revokedAt: null,
      },
    }),
  );
}

export async function listByOrg(orgId: string): Promise<AccountantClientLink[]> {
  return withOrgScope(orgId, (tx) =>
    tx.accountantClientLink.findMany({ where: { orgId }, orderBy: { invitedAt: "desc" } }),
  );
}

export async function findById(
  orgId: string,
  linkId: string,
): Promise<AccountantClientLink | null> {
  return withOrgScope(orgId, (tx) =>
    tx.accountantClientLink.findFirst({ where: { id: linkId, orgId } }),
  );
}

export async function revoke(orgId: string, linkId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.accountantClientLink.update({
      where: { id: linkId, orgId },
      data: { status: "revoked", revokedAt: new Date() },
    }),
  );
}

export interface AccountantLinkSummary {
  id: string;
  orgId: string;
  orgName: string;
  status: AccountantLinkStatus;
  invitedAt: Date;
  respondedAt: Date | null;
}

// The accountant reading their own cross-org link list — no single org
// context exists yet, so this goes through the SECURITY DEFINER function
// (list_accountant_links_for_user), the same shape as user.repository.ts's
// findByEmail for login. The function joins organisations directly (added in
// migration 20260730080000) rather than returning bare org_ids the caller
// would otherwise have to resolve one at a time — RLS means a normal batched
// findMany can't do that JOIN itself (one Postgres session only has one
// app.current_org_id, but this list can span many different client orgs).
export async function listForAccountant(
  userId: string,
  email: string,
): Promise<AccountantLinkSummary[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      org_id: string;
      org_name: string;
      status: AccountantLinkStatus;
      invited_at: Date;
      responded_at: Date | null;
    }[]
  >`SELECT * FROM list_accountant_links_for_user(${userId}::uuid, ${email}::citext)`;
  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    orgName: r.org_name,
    status: r.status,
    invitedAt: r.invited_at,
    respondedAt: r.responded_at,
  }));
}

// Accepting: clientOrgId is already known (resolved via listForAccountant
// first), so this writes through the normal withOrgScope path — the same
// two-step "resolve org, then scope" shape as
// invoice.repository.ts#findByPaymentPortalToken.
export async function accept(
  orgId: string,
  linkId: string,
  accountantUserId: string,
): Promise<AccountantClientLink> {
  return withOrgScope(orgId, (tx) =>
    tx.accountantClientLink.update({
      where: { id: linkId, orgId },
      data: { accountantUserId, status: "active", respondedAt: new Date() },
    }),
  );
}

export async function findActiveLink(
  orgId: string,
  accountantUserId: string,
): Promise<AccountantClientLink | null> {
  return withOrgScope(orgId, (tx) =>
    tx.accountantClientLink.findFirst({ where: { orgId, accountantUserId, status: "active" } }),
  );
}
