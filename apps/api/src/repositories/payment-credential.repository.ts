import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { OrgPaymentCredential, PaymentProcessor } from "@prisma/client";

export async function upsert(
  orgId: string,
  processor: PaymentProcessor,
  secretKeyEncrypted: string,
  publicKey?: string,
): Promise<OrgPaymentCredential> {
  return withOrgScope(orgId, (tx) =>
    tx.orgPaymentCredential.upsert({
      where: { orgId_processor: { orgId, processor } },
      create: { id: randomUUID(), orgId, processor, secretKeyEncrypted, publicKey, isActive: true },
      update: { secretKeyEncrypted, publicKey, isActive: true },
    }),
  );
}

export async function findByOrgAndProcessor(
  orgId: string,
  processor: PaymentProcessor,
): Promise<OrgPaymentCredential | null> {
  return withOrgScope(orgId, (tx) =>
    tx.orgPaymentCredential.findFirst({ where: { orgId, processor, isActive: true } }),
  );
}

export async function listByOrg(orgId: string): Promise<OrgPaymentCredential[]> {
  return withOrgScope(orgId, (tx) =>
    tx.orgPaymentCredential.findMany({ where: { orgId }, orderBy: { processor: "asc" } }),
  );
}

export async function deactivate(orgId: string, processor: PaymentProcessor): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.orgPaymentCredential.updateMany({ where: { orgId, processor }, data: { isActive: false } }),
  );
}
