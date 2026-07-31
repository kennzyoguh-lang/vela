import type { Request, Response } from "express";
import { env } from "./env";

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
// (Handbook 8.1), forecloses the most common XSS-to-token-theft path
// outright. Shared by every login path (email+password, 2FA challenge,
// phone+PIN) — all mint the same session shape via auth.service.ts's
// issueSession, so they all set the cookie identically. Both cookies live
// under /v1/auth (the marker excepted, which is Path=/), so a phone+PIN
// login under /v1/auth/staff/login is covered by the same scoping.
export function setRefreshCookie(
  res: Response,
  orgId: string,
  sessionFamilyId: string,
  token: string,
) {
  const maxAgeMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(
    REFRESH_COOKIE,
    `${orgId}.${sessionFamilyId}.${token}`,
    cookieOptions(maxAgeMs, "/v1/auth"),
  );
  res.cookie(SESSION_MARKER_COOKIE, "1", cookieOptions(maxAgeMs, "/"));
}

export function readRefreshCookie(
  req: Request,
): { orgId: string; sessionFamilyId: string; token: string } | null {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) return null;
  const [orgId, sessionFamilyId, token] = raw.split(".");
  if (!orgId || !sessionFamilyId || !token) return null;
  return { orgId, sessionFamilyId, token };
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/v1/auth" });
  res.clearCookie(SESSION_MARKER_COOKIE, { path: "/" });
}
