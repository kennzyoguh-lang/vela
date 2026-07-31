import { Router } from "express";
import * as cashCheckController from "../controllers/cash-check.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const cashCheckRouter = Router();
cashCheckRouter.use(requireAuth, apiRateLimit());

// Staff-facing — same audience as sale logging, needs to see today's
// expected figure to do the count.
cashCheckRouter.get(
  "/today",
  requireRole("owner", "admin", "staff"),
  asyncHandler(cashCheckController.today),
);
// No generic auditLog() middleware here — cash-check.service.ts#submitCashCheck
// already writes a richer audit entry itself (matched/mismatched action, plus
// expected/counted/difference amounts), which the generic middleware's
// entityId-only write would only duplicate.
cashCheckRouter.post(
  "/",
  requireRole("owner", "admin", "staff"),
  asyncHandler(cashCheckController.create),
);
// History view is an owner/admin reporting surface, not part of the staff flow.
cashCheckRouter.get("/", requireRole("owner", "admin"), asyncHandler(cashCheckController.list));
