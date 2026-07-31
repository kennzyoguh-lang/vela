import type { Request, Response } from "express";
import * as cashCheckService from "../services/cash-check.service";
import { submitCashCheckSchema } from "../validation/cash-check.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { parsePageParams } from "../lib/pagination";

export async function today(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const result = await cashCheckService.getExpectedForToday(orgId, new Date());
  sendSuccess(res, result);
}

export async function create(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const input = submitCashCheckSchema.parse(req.body);
  const record = await cashCheckService.submitCashCheck(orgId, userId, input.countedAmount);
  sendSuccess(res, record, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const page = await cashCheckService.listCashChecks(orgId, parsePageParams(req));
  sendSuccess(res, page);
}
