import type { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { signupSchema, loginSchema } from "../validation/auth.schema";
import { sendSuccess } from "../lib/response";
import { env } from "../lib/env";

const REFRESH_COOKIE = "vela_refresh";
// A second, non-sensitive marker — the refresh cookie above is deliberately
// scoped to Path=/v1/auth so it's only ever transmitted to the one endpoint
// that needs it, which also means it's invisible to the Next.js Edge
// middleware gating page renders for arbitrary dashboard routes (a cookie's
// Path restricts which request paths it's attached to, browser-side, and
// that check happens before the middleware ever runs). This cookie carries
// no secret — just "a session likely exists" — so it can be Path=/ instead.
const SESSION_MARKER_COOKIE = "vela_has_session";

function cookieOptions(maxAgeMs: number, path: string) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: maxAgeMs,
    path,
  };
}

// httpOnly + Secure + SameSite=Strict — never accessible to client-side JS
// (Handbook 8.1), forecloses the most common XSS-to-token-theft path outright.
function setRefreshCookie(res: Response, orgId: string, sessionFamilyId: string, token: string) {
  const maxAgeMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(
    REFRESH_COOKIE,
    `${orgId}.${sessionFamilyId}.${token}`,
    cookieOptions(maxAgeMs, "/v1/auth"),
  );
  res.cookie(SESSION_MARKER_COOKIE, "1", cookieOptions(maxAgeMs, "/"));
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
  setRefreshCookie(res, result.orgId, result.sessionFamilyId, result.refreshToken);
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
  setRefreshCookie(res, result.orgId, result.sessionFamilyId, result.refreshToken);
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
  res.clearCookie(SESSION_MARKER_COOKIE, { path: "/" });
  sendSuccess(res, { loggedOut: true });
}
