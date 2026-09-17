import type { Request, Response } from "express";
import * as expenseClaimService from "../services/expense-claim.service";
import {
  submitExpenseClaimSchema,
  rejectExpenseClaimSchema,
} from "../validation/expense-claim.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { parsePageParams } from "../lib/pagination";

export async function submit(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const input = submitExpenseClaimSchema.parse(req.body);
  const claim = await expenseClaimService.submitClaim(orgId, {
    ...input,
    submittedByUserId: userId,
  });
  sendSuccess(res, claim, 201);
}

// Owner/admin see every claim in the org; anyone else sees only their own —
// one endpoint, scoped by the caller's own role, rather than two routes
// the frontend would have to choose between.
export async function list(req: Request, res: Response) {
  const { orgId, userId, role } = getAuthContext(req);
  const page = parsePageParams(req);
  const claims =
    role === "owner" || role === "admin"
      ? await expenseClaimService.listAllClaims(orgId, page)
      : await expenseClaimService.listMyClaims(orgId, userId, page);
  sendSuccess(res, claims);
}

export async function approve(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const claim = await expenseClaimService.approveClaim(orgId, req.params.claimId!, userId);
  sendSuccess(res, claim);
}

export async function reject(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const { reason } = rejectExpenseClaimSchema.parse(req.body);
  const claim = await expenseClaimService.rejectClaim(orgId, req.params.claimId!, userId, reason);
  sendSuccess(res, claim);
}
