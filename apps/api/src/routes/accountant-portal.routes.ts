import { Router } from "express";
import * as accountantPortalController from "../controllers/accountant-portal.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const accountantPortalRouter = Router();
accountantPortalRouter.use(requireAuth, apiRateLimit());

accountantPortalRouter.get("/links", asyncHandler(accountantPortalController.listMyLinks));
accountantPortalRouter.post(
  "/links/:linkId/accept",
  asyncHandler(accountantPortalController.acceptLink),
);
accountantPortalRouter.get(
  "/client-orgs/:clientOrgId/summary",
  asyncHandler(accountantPortalController.getClientOrgSummary),
);
accountantPortalRouter.get("/earnings", asyncHandler(accountantPortalController.getEarnings));
