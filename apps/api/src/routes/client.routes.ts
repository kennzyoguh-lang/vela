import { Router } from "express";
import * as clientController from "../controllers/client.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const clientRouter = Router();
clientRouter.use(requireAuth, apiRateLimit());

clientRouter.post("/", auditLog("client.create", "client"), asyncHandler(clientController.create));
clientRouter.get("/", asyncHandler(clientController.list));
clientRouter.get("/:clientId", asyncHandler(clientController.getOne));
clientRouter.patch(
  "/:clientId",
  auditLog("client.update", "client"),
  asyncHandler(clientController.update),
);
