import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/jwt.service";
import { UnauthenticatedError } from "../lib/errors";

// First line of defense-in-depth (Handbook Part 8/5.5) — API routes re-validate
// independently of the Next.js middleware that gates page rendering.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthenticatedError());
  }
  try {
    const claims = verifyAccessToken(header.slice("Bearer ".length));
    req.userId = claims.sub;
    req.orgId = claims.orgId;
    req.role = claims.role;
    req.sessionFamilyId = claims.sessionFamilyId;
    next();
  } catch {
    next(new UnauthenticatedError("Access token expired or invalid"));
  }
}
