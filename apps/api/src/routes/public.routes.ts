import { Router } from "express";
import * as calculatorLeadController from "../controllers/calculator-lead.controller";
import { publicPortalRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

// No requireAuth anywhere in this router — genuinely public, unauthenticated
// marketing-site endpoints (Channel 1's FIRS penalty calculator, and future
// GTM-engine channels), same "standalone public page, no login" shape as
// payment-portal.routes.ts. Reuses that router's per-IP rate limiter rather
// than inventing a new one, since there's no org context to key on here
// either.
export const publicRouter = Router();
publicRouter.use(publicPortalRateLimit());

publicRouter.post("/calculator-leads", asyncHandler(calculatorLeadController.recordLead));
