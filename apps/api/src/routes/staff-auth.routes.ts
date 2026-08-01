import { Router } from "express";
import * as staffAuthController from "../controllers/staff-auth.controller";
import { pinLoginRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const staffAuthRouter = Router();

// No requireAuth — no session exists yet, same shape as /auth/login.
// No generic auditLog() middleware here — staff-auth.service.ts already
// writes its own audit entry for every outcome (succeeded/failed/device
// mismatch), each with a more specific action than a route-level middleware
// could produce; a second generic "auth.staff_pin_login" row here would
// just double-log every successful login.
staffAuthRouter.post("/login", pinLoginRateLimit(), asyncHandler(staffAuthController.login));
