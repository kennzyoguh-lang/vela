import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { BankAccount, BankSyncProvider } from "@prisma/client";

export async function create(
  orgId: string,
  input: {
    provider: BankSyncProvider;
    providerAccountId: string;
    institutionName: string;
    accountType: string;
    accountNumberMasked: string;
    currency: string;
  },
): Promise<BankAccount> {
  return withOrgScope(orgId, (tx) =>
    tx.bankAccount.create({
      data: {
        id: randomUUID(),
        orgId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        institutionName: input.institutionName,
        accountType: input.accountType,
        accountNumberMasked: input.accountNumberMasked,
        currency: input.currency,
      },
    }),
  );
}

export async function listActiveByOrg(orgId: string): Promise<BankAccount[]> {
  return withOrgScope(orgId, (tx) =>
    tx.bankAccount.findMany({ where: { orgId, isActive: true }, orderBy: { createdAt: "asc" } }),
  );
}

export async function findById(orgId: string, accountId: string): Promise<BankAccount | null> {
  return withOrgScope(orgId, (tx) => tx.bankAccount.findFirst({ where: { id: accountId, orgId } }));
}

export async function updateBalance(
  orgId: string,
  accountId: string,
  currentBalance: number,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.bankAccount.update({
      where: { id: accountId, orgId },
      data: { currentBalance, lastSyncedAt: new Date() },
    }),
  );
}
