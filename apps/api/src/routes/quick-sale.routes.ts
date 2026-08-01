import { Router } from "express";
import * as quickSaleController from "../controllers/quick-sale.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const quickSaleRouter = Router();
quickSaleRouter.use(requireAuth, apiRateLimit());

// No generic auditLog() middleware here — quick-sale.service.ts already
// writes its own audit entry (same reasoning as cash-check.routes.ts).
//
// staff included deliberately — Quick Sale is trader-facing (its entry
// screen lives on /pos/sell, the same staff-only POS area as sale logging
// and cash checks, both of which are already staff-accessible), not an
// owner/admin financial control point like manual invoice creation.
quickSaleRouter.post(
  "/",
  requireRole("owner", "admin", "staff"),
  asyncHandler(quickSaleController.create),
);

quickSaleRouter.post(
  "/:id/send-sms",
  requireRole("owner", "admin", "staff"),
  asyncHandler(quickSaleController.sendSms),
);
