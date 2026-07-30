import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import * as twoFactorController from "../controllers/two-factor.controller";
import { requireAuth } from "../middleware/auth.middleware";
import {
  loginRateLimit,
  signupRateLimit,
  twoFaVerifyRateLimit,
} from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const authRouter = Router();

authRouter.post(
  "/signup",
  signupRateLimit(),
  auditLog("auth.signup", "organisation"),
  asyncHandler(authController.signup),
);
authRouter.post(
  "/login",
  loginRateLimit(),
  auditLog("auth.login", "user"),
  asyncHandler(authController.login),
);
authRouter.post("/refresh", asyncHandler(authController.refresh));
authRouter.post("/logout", asyncHandler(authController.logout));

// Completes a login that paused on a 2FA challenge — distinct from
// /2fa/confirm below, which is the enrollment-confirmation endpoint (turning
// 2FA on for the first time, gated by requireAuth since you're already
// logged in to do that). This route has no session yet, hence no requireAuth.
authRouter.post(
  "/2fa/verify",
  twoFaVerifyRateLimit(),
  auditLog("auth.2fa_verified", "user"),
  asyncHandler(authController.verifyTwoFa),
);

authRouter.post("/2fa/setup", requireAuth, asyncHandler(twoFactorController.beginSetup));
authRouter.post(
  "/2fa/confirm",
  requireAuth,
  auditLog("auth.2fa_enabled", "user"),
  asyncHandler(twoFactorController.confirmSetup),
);
