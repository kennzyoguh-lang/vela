import type { Request, Response } from "express";
import * as complianceService from "../services/compliance.service";
import { toggleObligationSchema, markFiledSchema } from "../validation/compliance.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import type { ComplianceObligationType } from "@prisma/client";

export async function listObligations(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const obligations = await complianceService.listObligations(orgId);
  sendSuccess(res, obligations);
}

export async function toggleObligation(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { isActive } = toggleObligationSchema.parse(req.body);
  const obligationType = req.params.obligationType as ComplianceObligationType;
  const obligation = await complianceService.toggleObligation(orgId, obligationType, isActive);
  sendSuccess(res, obligation);
}

export async function listFilings(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const filings = await complianceService.listFilings(orgId);
  sendSuccess(res, filings);
}

export async function getFiling(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const filing = await complianceService.getFiling(orgId, req.params.filingId!);
  sendSuccess(res, filing);
}

export async function markFiled(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = markFiledSchema.parse(req.body);
  const filing = await complianceService.markFiled(orgId, req.params.filingId!, input);
  sendSuccess(res, filing);
}
