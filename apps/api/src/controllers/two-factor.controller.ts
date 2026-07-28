import type { Request, Response } from "express";
import * as twoFactorService from "../services/two-factor-enrollment.service";
import { twoFaVerifySchema } from "../validation/auth.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function beginSetup(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const { secret, uri } = await twoFactorService.beginEnrollment(orgId, userId, req.body.email);
  // The secret is round-tripped to the client only for this one setup flow and
  // confirmed via confirmSetup — never logged, never persisted until confirmed.
  sendSuccess(res, { secret, uri });
}

export async function confirmSetup(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const { code } = twoFaVerifySchema.parse(req.body);
  const { secret } = req.body as { secret: string };
  const { backupCodes } = await twoFactorService.confirmEnrollment(orgId, userId, secret, code);
  // Shown exactly once — Design System 3.12's explicit "I've saved these" gate
  // lives client-side; this response is the only time these plaintext codes exist.
  sendSuccess(res, { backupCodes }, 201);
}
