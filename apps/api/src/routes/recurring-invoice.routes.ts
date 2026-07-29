import { Router } from "express";
import * as recurringInvoiceController from "../controllers/recurring-invoice.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const recurringInvoiceRouter = Router();
recurringInvoiceRouter.use(requireAuth, apiRateLimit());

recurringInvoiceRouter.post(
  "/",
  auditLog("recurring_invoice.create", "recurring_invoice"),
  asyncHandler(recurringInvoiceController.create),
);
recurringInvoiceRouter.get("/", asyncHandler(recurringInvoiceController.list));
recurringInvoiceRouter.post(
  "/:scheduleId/pause",
  auditLog("recurring_invoice.pause", "recurring_invoice"),
  asyncHandler(recurringInvoiceController.pause),
);
recurringInvoiceRouter.post(
  "/:scheduleId/resume",
  auditLog("recurring_invoice.resume", "recurring_invoice"),
  asyncHandler(recurringInvoiceController.resume),
);
recurringInvoiceRouter.post(
  "/:scheduleId/cancel",
  auditLog("recurring_invoice.cancel", "recurring_invoice"),
  asyncHandler(recurringInvoiceController.cancel),
);
