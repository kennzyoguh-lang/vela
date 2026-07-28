import type { Request } from "express";
import { UnauthenticatedError } from "./errors";

export interface AuthContext {
  userId: string;
  orgId: string;
  role: string;
  sessionFamilyId: string;
}

/**
 * Narrows Express.Request's optional auth fields (set by requireAuth,
 * middleware/auth.middleware.ts) to guaranteed-present values. Throwing here
 * if any are missing is a real runtime safety net, not just a type cast — it
 * catches a route wired up without requireAuth in its chain (Handbook 1.4's
 * "fail loud in development").
 */
export function getAuthContext(req: Request): AuthContext {
  if (!req.userId || !req.orgId || !req.role || !req.sessionFamilyId) {
    throw new UnauthenticatedError();
  }
  return {
    userId: req.userId,
    orgId: req.orgId,
    role: req.role,
    sessionFamilyId: req.sessionFamilyId,
  };
}
