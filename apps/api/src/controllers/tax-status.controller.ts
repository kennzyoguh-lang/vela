import type { Request, Response } from "express";
import * as taxStatusService from "../services/tax-status.service";
import { setTaxProfileSchema } from "../validation/tax-status.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function getTaxStatus(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const status = await taxStatusService.getTaxStatus(orgId);
  sendSuccess(res, status);
}

export async function setTaxProfile(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const input = setTaxProfileSchema.parse(req.body);
  await taxStatusService.setTaxProfile(orgId, userId, input);
  sendSuccess(res, { updated: true });
}
