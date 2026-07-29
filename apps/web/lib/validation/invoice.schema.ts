import { z } from "zod";

// Mirrors apps/api/src/validation/invoice.schema.ts.
export const lineItemSchema = z.object({
  description: z.string().min(1, "Required").max(300),
  quantity: z.coerce.number().positive("Must be positive"),
  unitPrice: z.coerce.number().nonnegative("Must be 0 or more"),
});

export const quickCreateInvoiceSchema = z.object({
  clientId: z.string().uuid("Choose a client"),
  amount: z.coerce.number().positive("Enter an amount"),
  dueDate: z.string().min(1, "Choose a due date"),
  currency: z.string().length(3).default("NGN"),
});

export type LineItemFormValues = z.infer<typeof lineItemSchema>;
export type QuickCreateInvoiceFormValues = z.infer<typeof quickCreateInvoiceSchema>;
