import { Router, raw } from "express";
import * as webhookController from "../controllers/webhook.controller";
import { asyncHandler } from "../lib/async-handler";

// Mounted BEFORE the global express.json() in app.ts — signature verification
// needs the exact raw bytes of the body (Handbook 5.9), and re-serializing a
// parsed JSON object would produce different bytes than what was actually
// signed, breaking every HMAC check.
export const webhookRouter = Router();
webhookRouter.post(
  "/paystack",
  raw({ type: "application/json" }),
  asyncHandler(webhookController.paystackWebhook),
);
