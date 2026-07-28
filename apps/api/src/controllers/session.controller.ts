import type { Request, Response } from "express";
import * as sessionService from "../services/session.service";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function listSessions(req: Request, res: Response) {
  const { orgId, userId, sessionFamilyId } = getAuthContext(req);
  const sessions = await sessionService.listSessions(orgId, userId, sessionFamilyId);
  sendSuccess(res, sessions);
}

export async function terminateSession(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  // req.params.sessionId is guaranteed by the ":sessionId" route pattern —
  // noUncheckedIndexedAccess types ParamsDictionary's values as possibly
  // undefined regardless, since it can't see the route definition.
  await sessionService.terminate(orgId, userId, req.params.sessionId!);
  sendSuccess(res, { terminated: true });
}

export async function terminateAllOthers(req: Request, res: Response) {
  const { orgId, userId, sessionFamilyId } = getAuthContext(req);
  await sessionService.terminateAllOthers(orgId, userId, sessionFamilyId);
  sendSuccess(res, { terminated: true });
}
