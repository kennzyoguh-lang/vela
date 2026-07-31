import { Router } from "express";
import * as staffAuthController from "../controllers/staff-auth.controller";
import { pinLoginRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const staffAuthRouter = Router();

// No requireAuth — no session exists yet, same shape as /auth/login.
staffAuthRouter.post(
  "/login",
  pinLoginRateLimit(),
  auditLog("auth.staff_pin_login", "user"),
  asyncHandler(staffAuthController.login),
);
