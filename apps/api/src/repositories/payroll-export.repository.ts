import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { OrgPayrollExportConfig } from "@prisma/client";

export async function findByOrg(orgId: string): Promise<OrgPayrollExportConfig | null> {
  return withOrgScope(orgId, (tx) => tx.orgPayrollExportConfig.findFirst({ where: { orgId } }));
}

export async function upsert(
  orgId: string,
  webhookUrl: string,
  webhookSecretEncrypted: string,
): Promise<OrgPayrollExportConfig> {
  return withOrgScope(orgId, (tx) =>
    tx.orgPayrollExportConfig.upsert({
      where: { orgId },
      create: { id: randomUUID(), orgId, webhookUrl, webhookSecretEncrypted, isActive: true },
      update: { webhookUrl, webhookSecretEncrypted, isActive: true, lastDeliveryError: null },
    }),
  );
}

export async function updateSecret(
  orgId: string,
  webhookSecretEncrypted: string,
): Promise<OrgPayrollExportConfig> {
  return withOrgScope(orgId, (tx) =>
    tx.orgPayrollExportConfig.update({ where: { orgId }, data: { webhookSecretEncrypted } }),
  );
}

export async function recordDelivery(orgId: string, error: string | null): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.orgPayrollExportConfig.update({
      where: { orgId },
      data: { lastDeliveryAt: new Date(), lastDeliveryError: error },
    }),
  );
}

export async function deactivate(orgId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.orgPayrollExportConfig.updateMany({ where: { orgId }, data: { isActive: false } }),
  );
}
