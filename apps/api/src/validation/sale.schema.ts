import { z } from "zod";

// price/currency are never accepted from the client here — sale.service.ts
// looks them up server-side by productId. Trusting a client-sent price
// would be the obvious "pay less than the sticker price" tamper vector.
export const saleItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

// Anti-theft Piece 4 — a discount requires the org's shared approval PIN
// (never trusted as "already approved" just because a client sent it; see
// sale.service.ts#logSale's role-gated verification).
export const createSaleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1),
  customerName: z.string().max(200).optional(),
  discountAmount: z.number().nonnegative().optional(),
  approvalPin: z
    .string()
    .regex(/^\d{4,6}$/, "PIN must be 4-6 digits")
    .optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
