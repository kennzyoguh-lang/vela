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

// Mirrors invoice.schema.ts's quickCreateInvoiceSchema exactly — same
// progressive-confidence 3-field flow (Design System 5.7), same reasoning:
// nothing in this frontend has ever shipped a multi-line-item builder form,
// so the quote-creation UI follows the one proven pattern rather than
// inventing a new one for this feature alone.
export const quickCreateQuoteSchema = z.object({
  clientId: z.string().uuid(),
  amount: z.number().positive(),
  validUntil: z.coerce.date(),
  currency: z.string().length(3).default("NGN"),
});

export const declineQuoteSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type QuickCreateQuoteInput = z.infer<typeof quickCreateQuoteSchema>;
