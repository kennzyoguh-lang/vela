import type { Request, Response } from "express";
import * as accountantPortalService from "../services/accountant-portal.service";
import * as userRepo from "../repositories/user.repository";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { UnauthenticatedError } from "../lib/errors";

// The accountant's own email is needed to match pending invites (which have
// no accountantUserId yet, only the invited email) — not on the JWT, so read
// from the user row. email is nullable as of the phone+PIN staff-auth
// migration (a phone+PIN-only user has none) — the accountant portal is
// exclusively an email+password-login surface, so a null email here means
// this account can never have a pending accountant invite to match anyway.
async function getAccountantEmail(orgId: string, userId: string): Promise<string> {
  const user = await userRepo.findById(orgId, userId);
  if (!user || !user.email) throw new UnauthenticatedError();
  return user.email;
}

export async function listMyLinks(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const email = await getAccountantEmail(orgId, userId);
  const links = await accountantPortalService.listMyLinks(userId, email);
  sendSuccess(res, links);
}

export async function acceptLink(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const email = await getAccountantEmail(orgId, userId);
  const link = await accountantPortalService.acceptLink(userId, email, req.params.linkId!);
  sendSuccess(res, link);
}

export async function getClientOrgSummary(req: Request, res: Response) {
  const { userId } = getAuthContext(req);
  const summary = await accountantPortalService.getClientOrgSummary(
    userId,
    req.params.clientOrgId!,
  );
  sendSuccess(res, summary);
}
