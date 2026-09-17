import { Router } from "express";
import * as branchController from "../controllers/branch.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const branchRouter = Router();
branchRouter.use(requireAuth, apiRateLimit(), requireRole("owner", "admin"));

branchRouter.post("/", auditLog("branch.create", "branch"), asyncHandler(branchController.create));
branchRouter.get("/", asyncHandler(branchController.list));
branchRouter.patch(
  "/:branchId",
  auditLog("branch.update", "branch"),
  asyncHandler(branchController.update),
);
branchRouter.post(
  "/:branchId/deactivate",
  auditLog("branch.deactivate", "branch"),
  asyncHandler(branchController.deactivate),
);
// Assigning staff to a branch lives under /branches, not /organisation —
// it's branch-management's own write path, same precedent as the staff
// phone/PIN reset endpoints living under their own feature's router rather
// than a general user-admin one.
branchRouter.post(
  "/staff/:userId/assign",
  auditLog("branch.assign_staff", "user"),
  asyncHandler(branchController.assignStaff),
);
