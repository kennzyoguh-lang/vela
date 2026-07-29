import { Router } from "express";
import * as bankTransactionController from "../controllers/bank-transaction.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const bankTransactionRouter = Router();
bankTransactionRouter.use(requireAuth, apiRateLimit());

bankTransactionRouter.get("/", asyncHandler(bankTransactionController.listTransactions));
bankTransactionRouter.patch(
  "/:transactionId/category",
  requireRole("owner", "admin"),
  auditLog("bank_transaction.recategorized", "bank_transaction"),
  asyncHandler(bankTransactionController.recategorize),
);
