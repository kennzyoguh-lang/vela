import { Router } from "express";
import * as expenseClaimController from "../controllers/expense-claim.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const expenseClaimRouter = Router();
expenseClaimRouter.use(requireAuth, apiRateLimit());

// No requireRole — any authenticated org member submits/lists their own
// expense claims (expense-claim.controller.ts's own comment on `list`
// explains the owner/admin-vs-everyone-else scoping). No generic auditLog()
// middleware anywhere in this router — expense-claim.service.ts already
// writes its own audit entry for every mutation, same reasoning as
// discount-approval-pin/tax-status/kyc.
expenseClaimRouter.post("/", asyncHandler(expenseClaimController.submit));
expenseClaimRouter.get("/", asyncHandler(expenseClaimController.list));

// Approving/rejecting someone else's claim is owner/admin only.
expenseClaimRouter.post(
  "/:claimId/approve",
  requireRole("owner", "admin"),
  asyncHandler(expenseClaimController.approve),
);
expenseClaimRouter.post(
  "/:claimId/reject",
  requireRole("owner", "admin"),
  asyncHandler(expenseClaimController.reject),
);
