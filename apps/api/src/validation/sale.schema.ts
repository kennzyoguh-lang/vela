import { z } from "zod";

// price/currency are never accepted from the client here — sale.service.ts
// looks them up server-side by productId. Trusting a client-sent price
// would be the obvious "pay less than the sticker price" tamper vector.
export const saleItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1),
  customerName: z.string().max(200).optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
