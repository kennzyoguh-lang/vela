import type { Request, Response } from "express";
import * as payrollExportService from "../services/payroll-export.service";
import { configurePayrollExportSchema } from "../validation/payroll-export.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function configure(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { webhookUrl } = configurePayrollExportSchema.parse(req.body);
  const result = await payrollExportService.configure(orgId, webhookUrl);
  sendSuccess(res, result, 201);
}

export async function regenerateSecret(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const result = await payrollExportService.regenerateSecret(orgId);
  sendSuccess(res, result);
}

export async function getConfig(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const config = await payrollExportService.getConfig(orgId);
  sendSuccess(res, config);
}

export async function disable(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  await payrollExportService.disable(orgId);
  sendSuccess(res, { disabled: true });
}
