import { Router } from "express";
import * as cashFlowController from "../controllers/cash-flow.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const cashFlowRouter = Router();
cashFlowRouter.use(requireAuth, apiRateLimit());

// Open to every authenticated org role — same reasoning as pnl.routes.ts
// (a financial report derived from bank transactions, already readable by
// every role via P&L/reconciliation), not the payroll/employee-PII
// sensitivity class.
cashFlowRouter.get("/statement", asyncHandler(cashFlowController.getStatement));
cashFlowRouter.get("/projection", asyncHandler(cashFlowController.getProjection));
