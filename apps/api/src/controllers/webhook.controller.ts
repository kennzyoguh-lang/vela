import type { Request, Response } from "express";
import * as paymentWebhookService from "../services/payment-webhook.service";

// Handbook 5.9: respond fast, verify signature before parsing. Every outcome
// except an invalid signature is acknowledged with 200 — see
// payment-webhook.service.ts's WebhookOutcome doc comment for why.
export async function paystackWebhook(req: Request, res: Response) {
  const signature = req.headers["x-paystack-signature"];
  const outcome = await paymentWebhookService.processWebhook(
    "paystack",
    req.body as Buffer,
    typeof signature === "string" ? signature : undefined,
  );

  if (outcome === "invalid_signature") {
    res.status(400).json({
      success: false,
      error: { code: "WEBHOOK_REJECTED", message: "Signature verification failed" },
    });
    return;
  }

  res.status(200).json({ success: true, data: { outcome } });
}
