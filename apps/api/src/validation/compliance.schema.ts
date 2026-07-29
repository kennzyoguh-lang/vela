import { z } from "zod";

// Mirrors apps/web/lib/validation/compliance.schema.ts.
export const toggleObligationSchema = z.object({
  isActive: z.boolean(),
});

export const markFiledSchema = z.object({
  filedAt: z.coerce.date(),
  receiptReference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export type ToggleObligationInput = z.infer<typeof toggleObligationSchema>;
export type MarkFiledInput = z.infer<typeof markFiledSchema>;
