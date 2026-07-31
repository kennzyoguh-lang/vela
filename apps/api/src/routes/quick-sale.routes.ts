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
quickSaleRouter.post("/", requireRole("owner", "admin"), asyncHandler(quickSaleController.create));

quickSaleRouter.post(
  "/:id/send-sms",
  requireRole("owner", "admin"),
  asyncHandler(quickSaleController.sendSms),
);
