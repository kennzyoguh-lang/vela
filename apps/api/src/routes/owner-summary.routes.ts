import { Router } from "express";
import * as ownerSummaryController from "../controllers/owner-summary.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const ownerSummaryRouter = Router();
ownerSummaryRouter.use(requireAuth, apiRateLimit());

// Owner/admin only — this is the dashboard-login status banner, not
// something the POS staff role ever sees.
ownerSummaryRouter.get(
  "/today",
  requireRole("owner", "admin"),
  asyncHandler(ownerSummaryController.today),
);
