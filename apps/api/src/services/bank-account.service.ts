import * as bankAccountRepo from "../repositories/bank-account.repository";
import { getBankSyncGateway } from "./bank-sync";
import { NotFoundError } from "../lib/errors";
import type { BankSyncProvider } from "@prisma/client";

export async function linkAccount(orgId: string, provider: BankSyncProvider, code: string) {
  const gateway = getBankSyncGateway(provider);
  const linked = await gateway.exchangeLinkToken(code);

  const account = await bankAccountRepo.create(orgId, {
    provider,
    providerAccountId: linked.providerAccountId,
    institutionName: linked.institutionName,
    accountType: linked.accountType,
    accountNumberMasked: linked.accountNumberMasked,
    currency: linked.currency,
  });

  const balance = await gateway.fetchBalance(linked.providerAccountId);
  await bankAccountRepo.updateBalance(orgId, account.id, balance);

  return bankAccountRepo.findById(orgId, account.id);
}

export async function listAccounts(orgId: string) {
  return bankAccountRepo.listActiveByOrg(orgId);
}

export async function getAccount(orgId: string, accountId: string) {
  const account = await bankAccountRepo.findById(orgId, accountId);
  if (!account) throw new NotFoundError("Bank account not found");
  return account;
}

export async function refreshBalance(orgId: string, accountId: string) {
  const account = await getAccount(orgId, accountId);
  const gateway = getBankSyncGateway(account.provider);
  const balance = await gateway.fetchBalance(account.providerAccountId);
  await bankAccountRepo.updateBalance(orgId, accountId, balance);
  return bankAccountRepo.findById(orgId, accountId);
}
