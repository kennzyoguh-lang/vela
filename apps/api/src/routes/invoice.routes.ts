import { Router } from "express";
import * as invoiceController from "../controllers/invoice.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const invoiceRouter = Router();
invoiceRouter.use(requireAuth, apiRateLimit());

invoiceRouter.post(
  "/",
  requireRole("owner", "admin"),
  auditLog("invoice.create", "invoice"),
  asyncHandler(invoiceController.create),
);
invoiceRouter.post(
  "/quick-create",
  requireRole("owner", "admin"),
  auditLog("invoice.create", "invoice"),
  asyncHandler(invoiceController.quickCreate),
);
invoiceRouter.get("/", asyncHandler(invoiceController.list));
invoiceRouter.get("/:invoiceId", asyncHandler(invoiceController.getOne));
invoiceRouter.get("/:invoiceId/pdf", asyncHandler(invoiceController.downloadPdf));
invoiceRouter.post(
  "/:invoiceId/send",
  requireRole("owner", "admin"),
  auditLog("invoice.send", "invoice"),
  asyncHandler(invoiceController.send),
);
invoiceRouter.post(
  "/:invoiceId/mark-paid",
  requireRole("owner", "admin"),
  auditLog("invoice.mark_paid", "invoice"),
  asyncHandler(invoiceController.markPaidManually),
);
invoiceRouter.post(
  "/:invoiceId/void",
  requireRole("owner", "admin"),
  auditLog("invoice.void", "invoice"),
  asyncHandler(invoiceController.voidInvoice),
);
