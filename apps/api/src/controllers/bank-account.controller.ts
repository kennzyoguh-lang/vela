import type { Request, Response } from "express";
import * as bankAccountService from "../services/bank-account.service";
import { linkAccountSchema } from "../validation/bank-sync.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function linkAccount(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { provider, code } = linkAccountSchema.parse(req.body);
  const account = await bankAccountService.linkAccount(orgId, provider, code);
  sendSuccess(res, account, 201);
}

export async function listAccounts(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const accounts = await bankAccountService.listAccounts(orgId);
  sendSuccess(res, accounts);
}

export async function refreshBalance(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const account = await bankAccountService.refreshBalance(orgId, req.params.accountId!);
  sendSuccess(res, account);
}
