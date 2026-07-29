import { Router } from "express";
import * as askVelaController from "../controllers/ask-vela.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { askVelaRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const askVelaRouter = Router();
// No requireRole — Ask Vela never mutates business data (only reads, plus
// its own conversation rows), matching every other read-only route's
// requireAuth-only precedent (e.g. compliance.routes.ts).
askVelaRouter.use(requireAuth, askVelaRateLimit());

askVelaRouter.post("/conversations", asyncHandler(askVelaController.createConversation));
askVelaRouter.get("/conversations", asyncHandler(askVelaController.listConversations));
askVelaRouter.get(
  "/conversations/:conversationId",
  asyncHandler(askVelaController.getConversation),
);
askVelaRouter.post(
  "/conversations/:conversationId/messages",
  asyncHandler(askVelaController.sendMessage),
);
askVelaRouter.get("/insight", asyncHandler(askVelaController.getInsight));
