import { Router } from "express";
import * as quoteController from "../controllers/quote.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const quoteRouter = Router();
quoteRouter.use(requireAuth, apiRateLimit());

quoteRouter.post(
  "/",
  requireRole("owner", "admin"),
  auditLog("quote.create", "quote"),
  asyncHandler(quoteController.create),
);
quoteRouter.get("/", asyncHandler(quoteController.list));
quoteRouter.get("/:quoteId", asyncHandler(quoteController.getOne));
quoteRouter.post(
  "/:quoteId/send",
  requireRole("owner", "admin"),
  auditLog("quote.send", "quote"),
  asyncHandler(quoteController.send),
);
quoteRouter.post(
  "/:quoteId/convert-to-invoice",
  requireRole("owner", "admin"),
  auditLog("quote.convert_to_invoice", "quote"),
  asyncHandler(quoteController.convertToInvoice),
);
