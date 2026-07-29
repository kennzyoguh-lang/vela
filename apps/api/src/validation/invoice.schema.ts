import { z } from "zod";

// Mirrors apps/web/lib/validation/invoice.schema.ts — hand-kept in sync until
// the OpenAPI-generated shared schema pipeline exists (Handbook 4.7/7.8).
export const lineItemSchema = z.object({
  description: z.string().min(1).max(300),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

// Design System 5.7's progressive-confidence quick-create: only client, amount,
// due date are required — line items/tax/discount/notes are optional and
// revealed on the full editor, never demanded upfront.
export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  dueDate: z.coerce.date(),
  currency: z.string().length(3).default("NGN"),
  lineItems: z.array(lineItemSchema).min(1),
  tax: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  notes: z.string().max(2000).optional(),
});

export const quickCreateInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  amount: z.number().positive(),
  dueDate: z.coerce.date(),
  currency: z.string().length(3).default("NGN"),
});

export const voidInvoiceSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const markPaidSchema = z.object({
  amount: z.number().positive().optional(), // omitted = full amount
  method: z.string().max(100).optional(),
});

export type LineItem = z.infer<typeof lineItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type QuickCreateInvoiceInput = z.infer<typeof quickCreateInvoiceSchema>;
