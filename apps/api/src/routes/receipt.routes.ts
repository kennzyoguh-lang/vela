import { Router } from "express";
import * as receiptController from "../controllers/receipt.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";
import { uploadSingleFile } from "../lib/storage";

export const receiptRouter = Router();
receiptRouter.use(requireAuth, apiRateLimit());

// No requireRole — any authenticated org member can scan/submit a receipt
// (receipt.controller.ts's own comment explains why).
receiptRouter.post("/scan", uploadSingleFile("receipt"), asyncHandler(receiptController.scan));
receiptRouter.get("/:fileId", asyncHandler(receiptController.download));
