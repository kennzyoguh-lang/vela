import type { Request, Response } from "express";
import * as referralService from "../services/referral.service";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

// Owner/admin — reads (find-or-creates on first request) this org's own
// referral code, conversion count, tier, and accrued-reward descriptions.
export async function getSummary(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const summary = await referralService.getSummary(orgId);
  sendSuccess(res, summary);
}

// Public — no auth context. Used by /refer/[code] to validate a code
// before showing the signup CTA. Deliberately returns only {valid}, never
// the referrer's business name or any other detail — enough to render the
// page, not enough to enumerate businesses by guessing codes.
export async function validateCode(req: Request, res: Response) {
  const resolved = await referralService.resolveCode(req.params.code!);
  sendSuccess(res, { valid: resolved !== null });
}
