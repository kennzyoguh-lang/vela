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
// Bank reconciliation (reconciliation.service.ts) — suggests which unpaid
// invoice an incoming transfer likely settled; confirming one marks that
// invoice paid, so it gets the same owner/admin + audit-log treatment as
// invoice.routes.ts's own manual mark-paid endpoint.
bankTransactionRouter.get(
  "/reconciliation/suggestions",
  requireRole("owner", "admin"),
  asyncHandler(bankTransactionController.getReconciliationSuggestions),
);
bankTransactionRouter.post(
  "/:transactionId/reconciliation",
  requireRole("owner", "admin"),
  auditLog("bank_transaction.reconciled", "bank_transaction"),
  asyncHandler(bankTransactionController.confirmReconciliationMatch),
);
bankTransactionRouter.delete(
  "/:transactionId/reconciliation",
  requireRole("owner", "admin"),
  auditLog("bank_transaction.reconciliation_undone", "bank_transaction"),
  asyncHandler(bankTransactionController.undoReconciliationMatch),
);
