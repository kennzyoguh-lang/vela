import { withOrgScope } from "../lib/prisma";

export interface AuditLogEntry {
  orgId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

// audit_log is append-only at the database level (REVOKE UPDATE/DELETE + trigger,
// prisma/rls-and-security.sql.template) — this repository only ever calls
// `.create`, never `.update`/`.delete`, and there is no method here that could.
export async function write(entry: AuditLogEntry): Promise<void> {
  await withOrgScope(entry.orgId, (tx) =>
    tx.auditLog.create({
      data: {
        orgId: entry.orgId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: entry.oldValue as never,
        newValue: entry.newValue as never,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    }),
  );
}

export async function listByOrg(orgId: string, limit = 25) {
  return withOrgScope(orgId, (tx) =>
    tx.auditLog.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: limit }),
  );
}
