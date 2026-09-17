import { Router } from "express";
import * as paymentCredentialController from "../controllers/payment-credential.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

// Owner/admin only, every route — connecting or disconnecting a payment
// processor credential is exactly the kind of action Handbook 5.7 means by
// "security-sensitive," hence auditLog on both mutating routes despite the
// secret value itself never being logged (auditLog only ever records
// entityId, never req.body).
export const paymentCredentialRouter = Router();
paymentCredentialRouter.use(requireAuth, apiRateLimit(), requireRole("owner", "admin"));

paymentCredentialRouter.post(
  "/",
  auditLog("payment_credential.connect", "payment_credential"),
  asyncHandler(paymentCredentialController.connect),
);
paymentCredentialRouter.get("/", asyncHandler(paymentCredentialController.list));
paymentCredentialRouter.delete(
  "/:processor",
  auditLog("payment_credential.disconnect", "payment_credential"),
  asyncHandler(paymentCredentialController.disconnect),
);
