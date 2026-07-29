import type { Request, Response } from "express";
import * as bankTransactionService from "../services/bank-transaction.service";
import * as pnlService from "../services/pnl.service";
import { recategorizeSchema, pnlRangeSchema } from "../validation/bank-sync.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function listTransactions(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const transactions = await bankTransactionService.listTransactions(orgId);
  sendSuccess(res, transactions);
}

export async function recategorize(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { category } = recategorizeSchema.parse(req.body);
  const transaction = await bankTransactionService.recategorizeTransaction(
    orgId,
    req.params.transactionId!,
    category,
  );
  sendSuccess(res, transaction);
}

export async function getPnlStatement(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { from, to } = pnlRangeSchema.parse(req.query);
  const statement = await pnlService.getPnlStatement(orgId, from, to);
  sendSuccess(res, statement);
}
