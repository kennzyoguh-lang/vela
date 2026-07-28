import { Router } from "express";
import * as sessionController from "../controllers/session.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const sessionRouter = Router();
sessionRouter.use(requireAuth, apiRateLimit());

sessionRouter.get("/", asyncHandler(sessionController.listSessions));
sessionRouter.delete(
  "/:sessionId",
  auditLog("session.terminate", "user_session"),
  asyncHandler(sessionController.terminateSession),
);
sessionRouter.post(
  "/terminate-others",
  auditLog("session.terminate_others", "user_session"),
  asyncHandler(sessionController.terminateAllOthers),
);
