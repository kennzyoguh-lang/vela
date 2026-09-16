import { z } from "zod";
import { lineItemSchema } from "./invoice.schema";

// Mirrors invoice.schema.ts's createInvoiceSchema shape (same fields, same
// intent) — validUntil replaces dueDate since a quote expires rather than
// falling due.
export const createQuoteSchema = z.object({
  clientId: z.string().uuid(),
  validUntil: z.coerce.date(),
  currency: z.string().length(3).default("NGN"),
  lineItems: z.array(lineItemSchema).min(1),
  tax: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  notes: z.string().max(2000).optional(),
});

export const declineQuoteSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
