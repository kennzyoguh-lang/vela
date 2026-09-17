import type { Request, Response } from "express";
import * as bankTransactionService from "../services/bank-transaction.service";
import * as pnlService from "../services/pnl.service";
import * as reconciliationService from "../services/reconciliation.service";
import {
  recategorizeSchema,
  pnlRangeSchema,
  confirmReconciliationMatchSchema,
} from "../validation/bank-sync.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { parsePageParams } from "../lib/pagination";

export async function listTransactions(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const transactions = await bankTransactionService.listTransactions(orgId, parsePageParams(req));
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

export async function getReconciliationSuggestions(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const suggestions = await reconciliationService.suggestMatches(orgId);
  sendSuccess(res, suggestions);
}

export async function confirmReconciliationMatch(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { invoiceId } = confirmReconciliationMatchSchema.parse(req.body);
  await reconciliationService.confirmMatch(orgId, req.params.transactionId!, invoiceId);
  sendSuccess(res, { matched: true });
}

export async function undoReconciliationMatch(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  await reconciliationService.undoMatch(orgId, req.params.transactionId!);
  sendSuccess(res, { matched: false });
}
