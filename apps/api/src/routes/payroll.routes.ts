import { Router } from "express";
import * as payrollController from "../controllers/payroll.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const payrollRouter = Router();
payrollRouter.use(requireAuth, apiRateLimit());

payrollRouter.post(
  "/run",
  requireRole("owner", "admin"),
  auditLog("payroll.run", "payroll_run"),
  asyncHandler(payrollController.run),
);
payrollRouter.get("/", asyncHandler(payrollController.list));
payrollRouter.get("/:runId", asyncHandler(payrollController.getOne));
payrollRouter.post(
  "/:runId/mark-paid",
  requireRole("owner", "admin"),
  auditLog("payroll.marked_paid", "payroll_run"),
  asyncHandler(payrollController.markPaid),
);
payrollRouter.get(
  "/:runId/payslips/:payslipId/pdf",
  requireRole("owner", "admin"),
  asyncHandler(payrollController.downloadPayslipPdf),
);
