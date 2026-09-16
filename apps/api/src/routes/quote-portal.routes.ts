import { Router } from "express";
import * as quotePortalController from "../controllers/quote-portal.controller";
import { publicPortalRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

// No requireAuth anywhere in this router — mirrors payment-portal.routes.ts:
// standalone public page, no login, reached via the quote's own portal_token.
export const quotePortalRouter = Router();
quotePortalRouter.use(publicPortalRateLimit());

quotePortalRouter.get("/:token", asyncHandler(quotePortalController.getPublicQuote));
quotePortalRouter.post("/:token/accept", asyncHandler(quotePortalController.accept));
quotePortalRouter.post("/:token/decline", asyncHandler(quotePortalController.decline));
