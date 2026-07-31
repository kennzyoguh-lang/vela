import type { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { signupSchema, loginSchema, twoFaChallengeSchema } from "../validation/auth.schema";
import { sendSuccess } from "../lib/response";
import { setRefreshCookie, readRefreshCookie, clearSessionCookies } from "../lib/session-cookies";

export async function signup(req: Request, res: Response) {
  const input = signupSchema.parse(req.body);
  const result = await authService.signup(input);
  setRefreshCookie(res, result.orgId, result.sessionFamilyId, result.refreshToken);
  // The audit middleware (Handbook 5.7) reads req.orgId/userId at the moment
  // res.json() is called, not at middleware-registration time — signup is the
  // one route where those IDs don't exist until the service call above
  // completes, so they're set here, immediately before the response is sent.
  req.orgId = result.orgId;
  req.userId = result.userId;
  // A fresh signup never has 2FA enabled yet (that's a separate, later
  // enrollment flow) — requiresTwoFa is always false here, never read off
  // the service result.
  sendSuccess(res, { accessToken: result.accessToken, requiresTwoFa: false }, 201);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input, {
    deviceInfo: req.headers["user-agent"],
    ipAddress: req.ip,
  });

  if (result.requiresTwoFa) {
    // No session exists yet — the refresh cookie is not set. req.orgId/userId
    // are still set (from the already-verified password check) so the
    // auditLog("auth.login", "user") middleware on this route doesn't
    // silently no-op just because 2FA is enabled for this account.
    req.orgId = result.orgId;
    req.userId = result.userId;
    return sendSuccess(res, { requiresTwoFa: true, challengeToken: result.challengeToken });
  }

  setRefreshCookie(res, result.orgId, result.sessionFamilyId, result.refreshToken);
  req.orgId = result.orgId;
  req.userId = result.userId;
  sendSuccess(res, { accessToken: result.accessToken, requiresTwoFa: false });
}

// Completes a login that paused on a 2FA challenge (login() above returned
// requiresTwoFa: true). Not part of the enrollment flow (/2fa/setup,
// /2fa/confirm below) — this is the ongoing, every-future-login check.
export async function verifyTwoFa(req: Request, res: Response) {
  const { challengeToken, code } = twoFaChallengeSchema.parse(req.body);
  const result = await authService.verifyTwoFaChallenge(challengeToken, code, {
    deviceInfo: req.headers["user-agent"],
    ipAddress: req.ip,
  });
  setRefreshCookie(res, result.orgId, result.sessionFamilyId, result.refreshToken);
  req.orgId = result.orgId;
  req.userId = result.userId;
  sendSuccess(res, { accessToken: result.accessToken, requiresTwoFa: false });
}

export async function refresh(req: Request, res: Response) {
  const cookie = readRefreshCookie(req);
  if (!cookie) {
    return sendSuccess(res, { accessToken: null }, 401);
  }
  const result = await authService.refresh(cookie.orgId, cookie.sessionFamilyId, cookie.token);
  setRefreshCookie(res, cookie.orgId, cookie.sessionFamilyId, result.refreshToken);
  sendSuccess(res, { accessToken: result.accessToken });
}

export async function logout(req: Request, res: Response) {
  const cookie = readRefreshCookie(req);
  if (cookie) {
    await authService.logout(cookie.orgId, cookie.sessionFamilyId);
  }
  clearSessionCookies(res);
  sendSuccess(res, { loggedOut: true });
}
