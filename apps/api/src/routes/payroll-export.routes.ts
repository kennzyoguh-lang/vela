import { Router } from "express";
import * as payrollExportController from "../controllers/payroll-export.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

// Owner/admin only, every route — same sensitivity classification as
// payment-credential.routes.ts/accounting-connection.routes.ts (Handbook
// 5.7): every employee's payroll data leaving Vela for a third-party URL
// the org supplies is a security-sensitive, account-level action.
export const payrollExportRouter = Router();
payrollExportRouter.use(requireAuth, apiRateLimit(), requireRole("owner", "admin"));

payrollExportRouter.post(
  "/",
  auditLog("payroll_export.configure", "payroll_export_config"),
  asyncHandler(payrollExportController.configure),
);
payrollExportRouter.get("/", asyncHandler(payrollExportController.getConfig));
payrollExportRouter.post(
  "/regenerate-secret",
  auditLog("payroll_export.regenerate_secret", "payroll_export_config"),
  asyncHandler(payrollExportController.regenerateSecret),
);
payrollExportRouter.delete(
  "/",
  auditLog("payroll_export.disable", "payroll_export_config"),
  asyncHandler(payrollExportController.disable),
);
