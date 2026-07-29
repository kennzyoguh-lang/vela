import type { Request, Response } from "express";
import * as recurringInvoiceService from "../services/recurring-invoice.service";
import { createRecurringInvoiceSchema } from "../validation/recurring-invoice.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function create(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = createRecurringInvoiceSchema.parse(req.body);
  const schedule = await recurringInvoiceService.createSchedule(orgId, input);
  sendSuccess(res, schedule, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const schedules = await recurringInvoiceService.listSchedules(orgId);
  sendSuccess(res, schedules);
}

export async function pause(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  await recurringInvoiceService.pauseSchedule(orgId, req.params.scheduleId!);
  sendSuccess(res, { paused: true });
}

export async function resume(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  await recurringInvoiceService.resumeSchedule(orgId, req.params.scheduleId!);
  sendSuccess(res, { resumed: true });
}

export async function cancel(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  await recurringInvoiceService.cancelSchedule(orgId, req.params.scheduleId!);
  sendSuccess(res, { cancelled: true });
}
