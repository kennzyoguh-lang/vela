import { z } from "zod";

// Quick Sale / Instant Collect — deliberately just an amount. No client, no
// line items, no due date as inputs (Design System's "single number pad,
// one big Collect Payment button" requirement).
export const createQuickSaleSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default("NGN"),
});

export type CreateQuickSaleInput = z.infer<typeof createQuickSaleSchema>;

// Piece 4 — the "Pay ₦X now" SMS/WhatsApp link flow. Just a destination
// phone number and channel; the amount and link are derived server-side
// from the Quick Sale invoice itself, never re-entered. "sms" is the
// default so every existing caller (including the tests) keeps working
// unchanged.
export const sendQuickSalePaymentLinkSmsSchema = z.object({
  phone: z.string().min(7),
  channel: z.enum(["sms", "whatsapp"]).default("sms"),
});

export type SendQuickSalePaymentLinkSmsInput = z.infer<typeof sendQuickSalePaymentLinkSmsSchema>;
