import { Router } from "express";
import * as staffLeaderboardController from "../controllers/staff-leaderboard.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

// Owner/admin only — per-staff sales and cash-handling accuracy is the same
// sensitivity class as payroll (payroll.routes.ts locks its entire router
// the same way for the same reason).
export const staffLeaderboardRouter = Router();
staffLeaderboardRouter.use(requireAuth, apiRateLimit(), requireRole("owner", "admin"));

staffLeaderboardRouter.get("/", asyncHandler(staffLeaderboardController.getLeaderboard));
