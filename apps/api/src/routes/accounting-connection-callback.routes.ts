import { Router } from "express";
import * as accountingConnectionController from "../controllers/accounting-connection.controller";
import { publicPortalRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

// No requireAuth — mirrors quote-portal.routes.ts/payment-portal.routes.ts:
// the provider redirects the browser here directly, with no Vela session at
// all. Trust comes from the signed OAuth state token, not from auth
// middleware (accounting-connection.service.ts#handleCallback).
export const accountingConnectionCallbackRouter = Router();
accountingConnectionCallbackRouter.use(publicPortalRateLimit());

accountingConnectionCallbackRouter.get(
  "/:provider",
  asyncHandler(accountingConnectionController.callback),
);
