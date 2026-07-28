import type { Request, Response, NextFunction } from "express";
import { checkAndIncrement } from "../services/rate-limit.service";
import { RateLimitedError } from "../lib/errors";

// BRD 5.2 / Handbook 5.6: login 5/min per IP+email, general API 100/min per org.
export function loginRateLimit() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "unknown";
    const key = `ratelimit:login:${req.ip}:${email}`;
    const { allowed } = await checkAndIncrement(key, 5, 60);
    if (!allowed)
      return next(new RateLimitedError("Too many login attempts — try again shortly", 60));
    next();
  };
}

export function apiRateLimit() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.orgId) return next(); // unauthenticated routes are covered by their own limiter
    const key = `ratelimit:api:${req.orgId}`;
    const { allowed } = await checkAndIncrement(key, 100, 60);
    if (!allowed)
      return next(new RateLimitedError("Rate limit exceeded for this organisation", 60));
    next();
  };
}
