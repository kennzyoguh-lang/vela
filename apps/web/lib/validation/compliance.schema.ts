import { z } from "zod";

// Mirrors apps/api/src/validation/compliance.schema.ts.
export const markFiledSchema = z.object({
  filedAt: z.string().min(1, "Choose a date"),
  receiptReference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export type MarkFiledFormValues = z.infer<typeof markFiledSchema>;
