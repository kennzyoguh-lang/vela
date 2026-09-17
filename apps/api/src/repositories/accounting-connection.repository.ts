import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { AccountingProvider, OrgAccountingConnection } from "@prisma/client";

export interface UpsertConnectionInput {
  externalTenantId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
}

export async function upsert(
  orgId: string,
  provider: AccountingProvider,
  input: UpsertConnectionInput,
): Promise<OrgAccountingConnection> {
  return withOrgScope(orgId, (tx) =>
    tx.orgAccountingConnection.upsert({
      where: { orgId_provider: { orgId, provider } },
      create: { id: randomUUID(), orgId, provider, isActive: true, ...input },
      update: { isActive: true, lastSyncError: null, ...input },
    }),
  );
}

export async function findByOrgAndProvider(
  orgId: string,
  provider: AccountingProvider,
): Promise<OrgAccountingConnection | null> {
  return withOrgScope(orgId, (tx) =>
    tx.orgAccountingConnection.findFirst({ where: { orgId, provider, isActive: true } }),
  );
}

export async function listByOrg(orgId: string): Promise<OrgAccountingConnection[]> {
  return withOrgScope(orgId, (tx) =>
    tx.orgAccountingConnection.findMany({ where: { orgId }, orderBy: { provider: "asc" } }),
  );
}

export interface ActiveConnectionRef {
  orgId: string;
  provider: AccountingProvider;
}

export async function listAllActiveRefs(): Promise<ActiveConnectionRef[]> {
  // Cross-org read for the daily push job (accounting-push.job.ts) — goes
  // through the list_active_accounting_connections() SECURITY DEFINER
  // function (same shape as organisation.repository.ts#listAllOrgIds)
  // rather than a direct query, since a direct query as api_write_role with
  // no app.current_org_id set would simply return zero rows under this
  // table's RLS policy, not the cross-org list the job actually needs.
  // Every other function in this file acts on one already-known org's own
  // data via withOrgScope; this is the one exception, and it returns only
  // org_id/provider, never the encrypted token columns.
  const { prisma } = await import("../lib/prisma");
  const rows = await prisma.$queryRaw<{ org_id: string; provider: AccountingProvider }[]>`
    SELECT * FROM list_active_accounting_connections()
  `;
  return rows.map((r) => ({ orgId: r.org_id, provider: r.provider }));
}

export async function updateTokens(
  connectionId: string,
  orgId: string,
  accessTokenEncrypted: string,
  refreshTokenEncrypted: string,
  tokenExpiresAt: Date,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.orgAccountingConnection.update({
      where: { id: connectionId },
      data: { accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt },
    }),
  );
}

export async function recordSyncResult(
  connectionId: string,
  orgId: string,
  error: string | null,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.orgAccountingConnection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date(), lastSyncError: error },
    }),
  );
}

export async function deactivate(orgId: string, provider: AccountingProvider): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.orgAccountingConnection.updateMany({
      where: { orgId, provider },
      data: { isActive: false },
    }),
  );
}
