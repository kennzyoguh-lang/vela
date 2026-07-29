import { Router } from "express";
import * as paymentPortalController from "../controllers/payment-portal.controller";
import { publicPortalRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

// No requireAuth anywhere in this router — Design System 6.13: standalone
// public page, no login, reached via the invoice's payment_portal_token.
export const paymentPortalRouter = Router();
paymentPortalRouter.use(publicPortalRateLimit());

paymentPortalRouter.get("/:token", asyncHandler(paymentPortalController.getPublicInvoice));
paymentPortalRouter.post("/:token/pay", asyncHandler(paymentPortalController.initiatePayment));
