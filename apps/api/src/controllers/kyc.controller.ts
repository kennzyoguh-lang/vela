import type { Request, Response } from "express";
import * as kycService from "../services/kyc.service";
import { submitNinSchema, submitBvnSchema } from "../validation/kyc.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function getStatus(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const status = await kycService.getStatus(orgId);
  sendSuccess(res, status);
}

export async function submitNin(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { nin } = submitNinSchema.parse(req.body);
  await kycService.submitNin(orgId, nin);
  sendSuccess(res, { submitted: true });
}

export async function submitBvn(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { bvn } = submitBvnSchema.parse(req.body);
  await kycService.submitBvn(orgId, bvn);
  sendSuccess(res, { submitted: true });
}
