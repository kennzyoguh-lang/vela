import type { Request, Response } from "express";
import * as calculatorLeadService from "../services/calculator-lead.service";
import { recordCalculatorLeadSchema } from "../validation/calculator-lead.schema";
import { sendSuccess } from "../lib/response";

// No auth context — this is a public, unauthenticated lead-capture endpoint
// (see public.routes.ts). Recomputes and stores the penalty totals
// server-side (calculator-lead.service.ts#recordLead), never trusting a
// client-sent total.
export async function recordLead(req: Request, res: Response) {
  const input = recordCalculatorLeadSchema.parse(req.body);
  await calculatorLeadService.recordLead(input);
  sendSuccess(res, { recorded: true }, 201);
}
