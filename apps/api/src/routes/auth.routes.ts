import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import * as twoFactorController from "../controllers/two-factor.controller";
import { requireAuth } from "../middleware/auth.middleware";
import {
  loginRateLimit,
  signupRateLimit,
  twoFaVerifyRateLimit,
  emailVerifyRateLimit,
  resendVerificationRateLimit,
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
// No generic auditLog() middleware here — auth.service.ts#verifyTwoFaChallenge
// already writes its own audit entry (2fa.challenge_succeeded/backup_code_used/
// challenge_failed); a route-level "auth.2fa_verified" here would double-log
// every successful verification.
authRouter.post("/2fa/verify", twoFaVerifyRateLimit(), asyncHandler(authController.verifyTwoFa));

authRouter.post("/2fa/setup", requireAuth, asyncHandler(twoFactorController.beginSetup));
// No generic auditLog() middleware here — two-factor-enrollment.service.ts's
// confirmEnrollment already writes its own "2fa.enabled" entry; same
// double-log reasoning as /2fa/verify above.
// twoFaVerifyRateLimit() reused here — confirmEnrollment verifies a guessable
// 6-digit TOTP code with no per-user lockout of its own (unlike
// verifyTwoFaChallenge's isTwoFaLockedOut), so this is the only brute-force
// throttle on it.
authRouter.post(
  "/2fa/confirm",
  requireAuth,
  twoFaVerifyRateLimit(),
  asyncHandler(twoFactorController.confirmSetup),
);

// No requireAuth — the signed token itself proves the request is
// legitimate (see auth.service.ts#verifyEmail), same "resolve, then act"
// shape as /2fa/verify above.
authRouter.post("/verify-email", emailVerifyRateLimit(), asyncHandler(authController.verifyEmail));
authRouter.post(
  "/resend-verification",
  requireAuth,
  resendVerificationRateLimit(),
  asyncHandler(authController.resendVerification),
);

// Backs the dashboard's email-verification banner (apps/web's
// EmailVerificationBanner) — a fresh read, not a token claim, so the banner
// reacts immediately to a just-completed verification.
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
