import { z } from "zod";
import { lineItemSchema } from "./invoice.schema";

export const createRecurringInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  frequency: z.enum(["weekly", "monthly", "quarterly"]),
  startDate: z.coerce.date(),
  lineItems: z.array(lineItemSchema).min(1),
  tax: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  currency: z.string().length(3).default("NGN"),
  netDays: z.number().int().min(0).max(365).default(14),
});

export type CreateRecurringInvoiceInput = z.infer<typeof createRecurringInvoiceSchema>;
