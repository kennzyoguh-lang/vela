import { Router } from "express";
import * as bankTransactionController from "../controllers/bank-transaction.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const pnlRouter = Router();
pnlRouter.use(requireAuth, apiRateLimit());

pnlRouter.get("/", asyncHandler(bankTransactionController.getPnlStatement));
