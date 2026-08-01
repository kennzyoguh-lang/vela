import type { Request, Response } from "express";
import * as businessProfileService from "../services/business-profile.service";
import {
  setBusinessProfileFactorsSchema,
  setModuleOverrideSchema,
} from "../validation/business-profile.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function getProfile(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const profile = await businessProfileService.getBusinessProfile(orgId);
  sendSuccess(res, profile);
}

export async function setFactors(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const input = setBusinessProfileFactorsSchema.parse(req.body);
  await businessProfileService.setBusinessProfileFactors(orgId, userId, input);
  sendSuccess(res, { updated: true });
}

export async function setModuleOverride(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const { moduleKey, value } = setModuleOverrideSchema.parse(req.body);
  await businessProfileService.setModuleOverride(orgId, userId, moduleKey, value);
  sendSuccess(res, { updated: true });
}
