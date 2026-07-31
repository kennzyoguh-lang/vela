import type { Request, Response } from "express";
import * as ownerSummaryService from "../services/owner-summary.service";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function today(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const summary = await ownerSummaryService.getTodaySummary(orgId, new Date());
  sendSuccess(res, summary);
}
