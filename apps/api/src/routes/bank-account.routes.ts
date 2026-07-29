import { Router } from "express";
import * as bankAccountController from "../controllers/bank-account.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const bankAccountRouter = Router();
bankAccountRouter.use(requireAuth, apiRateLimit());

bankAccountRouter.post(
  "/link",
  auditLog("bank_account.linked", "bank_account"),
  asyncHandler(bankAccountController.linkAccount),
);
bankAccountRouter.get("/", asyncHandler(bankAccountController.listAccounts));
bankAccountRouter.post("/:accountId/refresh", asyncHandler(bankAccountController.refreshBalance));
