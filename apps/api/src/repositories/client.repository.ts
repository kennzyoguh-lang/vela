import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { Client } from "@prisma/client";

export async function createClient(
  orgId: string,
  input: { name: string; email?: string; phone?: string; address?: string; paymentTerms: number },
): Promise<Client> {
  return withOrgScope(orgId, (tx) =>
    tx.client.create({
      data: {
        id: randomUUID(),
        orgId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        paymentTerms: input.paymentTerms,
      },
    }),
  );
}

export async function findById(orgId: string, clientId: string): Promise<Client | null> {
  return withOrgScope(orgId, (tx) => tx.client.findFirst({ where: { id: clientId, orgId } }));
}

export async function listByOrg(orgId: string): Promise<Client[]> {
  return withOrgScope(orgId, (tx) =>
    tx.client.findMany({ where: { orgId }, orderBy: { name: "asc" } }),
  );
}

export async function update(
  orgId: string,
  clientId: string,
  input: Partial<{
    name: string;
    email: string;
    phone: string;
    address: string;
    paymentTerms: number;
  }>,
): Promise<Client> {
  return withOrgScope(orgId, (tx) =>
    tx.client.update({ where: { id: clientId, orgId }, data: input }),
  );
}

export async function updateAvgPaymentDays(
  orgId: string,
  clientId: string,
  avgPaymentDays: number,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.client.update({ where: { id: clientId, orgId }, data: { avgPaymentDays } }),
  );
}
