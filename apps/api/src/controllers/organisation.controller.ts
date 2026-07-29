import type { Request, Response } from "express";
import * as organisationService from "../services/organisation.service";
import * as accountantLinkService from "../services/accountant-link.service";
import { inviteSchema } from "../validation/auth.schema";
import { inviteAccountantSchema } from "../validation/accountant-link.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function inviteUser(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const input = inviteSchema.parse(req.body);
  const invite = await organisationService.inviteUser(orgId, userId, input.email, input.role);
  sendSuccess(res, invite, 201);
}

export async function listPendingInvites(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const invites = await organisationService.listPendingInvites(orgId);
  sendSuccess(res, invites);
}

// req.params.* below are guaranteed by each route's ":inviteId"/":userId"
// pattern — noUncheckedIndexedAccess types ParamsDictionary's values as
// possibly undefined regardless, since it can't see the route definition.

export async function revokeInvite(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  await organisationService.revokeInvite(orgId, userId, req.params.inviteId!);
  sendSuccess(res, { revoked: true });
}

export async function changeUserRole(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  await organisationService.changeRole(orgId, userId, req.params.userId!, req.body.role);
  sendSuccess(res, { updated: true });
}

export async function deactivateUser(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  await organisationService.deactivateUser(orgId, userId, req.params.userId!);
  sendSuccess(res, { deactivated: true });
}

export async function inviteAccountant(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const { email } = inviteAccountantSchema.parse(req.body);
  const link = await accountantLinkService.inviteAccountant(orgId, userId, email);
  sendSuccess(res, link, 201);
}

export async function listAccountantLinks(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const links = await accountantLinkService.listLinksForOrg(orgId);
  sendSuccess(res, links);
}

export async function revokeAccountantLink(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  await accountantLinkService.revokeLink(orgId, userId, req.params.linkId!);
  sendSuccess(res, { revoked: true });
}
