import type { Request, Response, NextFunction } from "express";
import { checkAndIncrement } from "../services/rate-limit.service";
import { RateLimitedError } from "../lib/errors";
import { asyncHandler } from "../lib/async-handler";

// BRD 5.2 / Handbook 5.6: login 5/min per IP+email, general API 100/min per org.
// Wrapped in asyncHandler (not just controllers) — a rejected Redis call here
// is otherwise an unhandled promise rejection that crashes the whole process,
// since Express only forwards thrown errors to errorHandler for synchronous
// middleware or routes it wraps itself.
export function loginRateLimit() {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "unknown";
    const key = `ratelimit:login:${req.ip}:${email}`;
    const { allowed } = await checkAndIncrement(key, 5, 60);
    if (!allowed)
      return next(new RateLimitedError("Too many login attempts — try again shortly", 60));
    next();
  });
}

export function apiRateLimit() {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.orgId) return next(); // unauthenticated routes are covered by their own limiter
    const key = `ratelimit:api:${req.orgId}`;
    const { allowed } = await checkAndIncrement(key, 100, 60);
    if (!allowed)
      return next(new RateLimitedError("Rate limit exceeded for this organisation", 60));
    next();
  });
}

// Ask Vela (Phase 7) gets its own, stricter limit than apiRateLimit's
// 100/60s — each request can trigger several LLM round-trips, unlike
// ordinary CRUD, so the per-org budget is deliberately much lower.
export function askVelaRateLimit() {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.orgId) return next();
    const key = `ratelimit:ask-vela:${req.orgId}`;
    const { allowed } = await checkAndIncrement(key, 20, 60);
    if (!allowed)
      return next(new RateLimitedError("Ask Vela rate limit exceeded for this organisation", 60));
    next();
  });
}

// Thin per-IP limiter on the 2FA challenge endpoint — DoS/hammering
// protection only. The actual brute-force control on the 6-digit code is
// the per-userId lockout inside auth.service.ts#verifyTwoFaChallenge
// (isTwoFaLockedOut/recordTwoFaFailure), not this: a per-IP-only limit would
// still let an attacker spread guesses across many IPs, and a login()-issued
// challenge token can't be rate-limited by its own value either, since a
// stolen password mints a fresh one on demand.
export function twoFaVerifyRateLimit() {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const key = `ratelimit:2fa-verify:${req.ip}`;
    const { allowed } = await checkAndIncrement(key, 20, 60);
    if (!allowed) return next(new RateLimitedError("Too many attempts — try again shortly", 60));
    next();
  });
}

// The public payment portal (Handbook 7.1) is unauthenticated by design, so
// it gets its own, stricter, per-IP limit rather than apiRateLimit's per-org
// one (there's no org context to key on until the token is resolved).
export function publicPortalRateLimit() {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const key = `ratelimit:portal:${req.ip}`;
    const { allowed } = await checkAndIncrement(key, 30, 60);
    if (!allowed) return next(new RateLimitedError("Too many requests — try again shortly", 60));
    next();
  });
}
