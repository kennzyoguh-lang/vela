import { Router } from "express";
import * as saleController from "../controllers/sale.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const saleRouter = Router();
saleRouter.use(requireAuth, apiRateLimit());

// Staff-facing action — the whole point of this feature.
saleRouter.post(
  "/",
  requireRole("owner", "admin", "staff"),
  auditLog("sale.create", "sale"),
  asyncHandler(saleController.create),
);
// Owner/admin reporting — unused by Piece 1's UI, present so Piece 2 (cash
// reconciliation) doesn't need a schema/route change.
saleRouter.get("/", requireRole("owner", "admin"), asyncHandler(saleController.list));
