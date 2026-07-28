import type { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { signupSchema, loginSchema } from "../validation/auth.schema";
import { sendSuccess } from "../lib/response";
import { env } from "../lib/env";

const REFRESH_COOKIE = "vela_refresh";

// httpOnly + Secure + SameSite=Strict — never accessible to client-side JS
// (Handbook 8.1), forecloses the most common XSS-to-token-theft path outright.
function setRefreshCookie(res: Response, orgId: string, sessionFamilyId: string, token: string) {
  res.cookie(REFRESH_COOKIE, `${orgId}.${sessionFamilyId}.${token}`, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/v1/auth",
  });
}

function readRefreshCookie(
  req: Request,
): { orgId: string; sessionFamilyId: string; token: string } | null {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) return null;
  const [orgId, sessionFamilyId, token] = raw.split(".");
  if (!orgId || !sessionFamilyId || !token) return null;
  return { orgId, sessionFamilyId, token };
}

export async function signup(req: Request, res: Response) {
  const input = signupSchema.parse(req.body);
  const result = await authService.signup(input);
  setRefreshCookie(res, result.orgId, result.userId, result.refreshToken);
  // The audit middleware (Handbook 5.7) reads req.orgId/userId at the moment
  // res.json() is called, not at middleware-registration time — signup is the
  // one route where those IDs don't exist until the service call above
  // completes, so they're set here, immediately before the response is sent.
  req.orgId = result.orgId;
  req.userId = result.userId;
  sendSuccess(res, { accessToken: result.accessToken, requiresTwoFa: result.requiresTwoFa }, 201);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input, {
    deviceInfo: req.headers["user-agent"],
    ipAddress: req.ip,
  });
  setRefreshCookie(res, result.orgId, result.userId, result.refreshToken);
  req.orgId = result.orgId;
  req.userId = result.userId;
  sendSuccess(res, { accessToken: result.accessToken, requiresTwoFa: result.requiresTwoFa });
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
  res.clearCookie(REFRESH_COOKIE, { path: "/v1/auth" });
  sendSuccess(res, { loggedOut: true });
}
