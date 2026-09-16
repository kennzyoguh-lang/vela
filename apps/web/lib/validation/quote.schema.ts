import { z } from "zod";

// Mirrors apps/api/src/validation/quote.schema.ts's quickCreateQuoteSchema.
export const quickCreateQuoteSchema = z.object({
  clientId: z.string().uuid("Choose a client"),
  amount: z.coerce.number().positive("Enter an amount"),
  validUntil: z.string().min(1, "Choose an expiry date"),
  currency: z.string().length(3).default("NGN"),
});

export type QuickCreateQuoteFormValues = z.infer<typeof quickCreateQuoteSchema>;
