import { Router } from "express";
import * as bankTransactionController from "../controllers/bank-transaction.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const pnlRouter = Router();
pnlRouter.use(requireAuth, apiRateLimit());

// Open to every authenticated org role, matching invoice.routes.ts and
// compliance.routes.ts's GET endpoints — a P&L statement is a financial
// document derived from bank transactions and invoices, both already
// readable by every role (accountant/view_only's whole purpose is read
// access to exactly this kind of data). Not the same sensitivity class as
// payroll/employee PII, which is deliberately locked down further
// (employee.routes.ts, payroll.routes.ts).
pnlRouter.get("/", asyncHandler(bankTransactionController.getPnlStatement));
