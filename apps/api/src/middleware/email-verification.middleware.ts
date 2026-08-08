import type { Request, Response, NextFunction } from "express";
import * as userRepo from "../repositories/user.repository";
import { EmailNotVerifiedError, NotFoundError } from "../lib/errors";
import { asyncHandler } from "../lib/async-handler";

// Applied to a deliberately small set of sensitive actions (email-based
// invites, discount-approval-PIN) — not as a login gate, and deliberately
// NOT on staff creation (phone+PIN accounts are core day-one POS setup, done
// before an owner has necessarily checked their inbox — see
// organisation.routes.ts's /staff route). Never locks an owner out of the
// account they just created over a flaky inbox. Runs after requireAuth, so
// req.orgId/req.userId are already set. A phone+PIN staff user (email null,
// emailVerifiedAt always null) never reaches a route this is applied to.
export const requireVerifiedEmail = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const user = await userRepo.findById(req.orgId!, req.userId!);
    if (!user) return next(new NotFoundError("Account not found"));
    if (!user.emailVerifiedAt) return next(new EmailNotVerifiedError());
    next();
  },
);
