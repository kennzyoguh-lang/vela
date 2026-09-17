import { Router } from "express";
import * as accountingConnectionController from "../controllers/accounting-connection.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

// Owner/admin only, every route — same sensitivity classification as
// payment-credential.routes.ts (Handbook 5.7): connecting an external
// accounting app is a security-sensitive, account-level action.
export const accountingConnectionRouter = Router();
accountingConnectionRouter.use(requireAuth, apiRateLimit(), requireRole("owner", "admin"));

accountingConnectionRouter.get(
  "/providers",
  asyncHandler(accountingConnectionController.listProviderAvailability),
);
accountingConnectionRouter.post(
  "/:provider/authorize-url",
  asyncHandler(accountingConnectionController.getAuthorizeUrl),
);
accountingConnectionRouter.get("/", asyncHandler(accountingConnectionController.list));
accountingConnectionRouter.delete(
  "/:provider",
  auditLog("accounting_connection.disconnect", "accounting_connection"),
  asyncHandler(accountingConnectionController.disconnect),
);
