import type { Request, Response } from "express";
import * as cashFlowService from "../services/cash-flow.service";
import { pnlRangeSchema } from "../validation/bank-sync.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function getStatement(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { from, to } = pnlRangeSchema.parse(req.query);
  const statement = await cashFlowService.getCashFlowStatement(orgId, from, to);
  sendSuccess(res, statement);
}

export async function getProjection(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const projection = await cashFlowService.getCashFlowProjection(orgId, new Date());
  sendSuccess(res, projection);
}
