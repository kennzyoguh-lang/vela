import { Router } from "express";
import * as bankAccountController from "../controllers/bank-account.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const bankAccountRouter = Router();
bankAccountRouter.use(requireAuth, apiRateLimit());

bankAccountRouter.post(
  "/link",
  requireRole("owner", "admin"),
  auditLog("bank_account.linked", "bank_account"),
  asyncHandler(bankAccountController.linkAccount),
);
bankAccountRouter.get("/", asyncHandler(bankAccountController.listAccounts));
bankAccountRouter.post(
  "/:accountId/refresh",
  requireRole("owner", "admin"),
  asyncHandler(bankAccountController.refreshBalance),
);
