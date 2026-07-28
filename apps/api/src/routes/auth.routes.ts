import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import * as twoFactorController from "../controllers/two-factor.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { loginRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const authRouter = Router();

authRouter.post(
  "/signup",
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

authRouter.post("/2fa/setup", requireAuth, asyncHandler(twoFactorController.beginSetup));
authRouter.post(
  "/2fa/confirm",
  requireAuth,
  auditLog("auth.2fa_enabled", "user"),
  asyncHandler(twoFactorController.confirmSetup),
);
