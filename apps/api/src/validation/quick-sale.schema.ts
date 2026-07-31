import { z } from "zod";

// Quick Sale / Instant Collect — deliberately just an amount. No client, no
// line items, no due date as inputs (Design System's "single number pad,
// one big Collect Payment button" requirement).
export const createQuickSaleSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default("NGN"),
});

export type CreateQuickSaleInput = z.infer<typeof createQuickSaleSchema>;
