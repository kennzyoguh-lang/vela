import { z } from "zod";

// Mirrors apps/api/src/validation/bank-sync.schema.ts.
export const recategorizeSchema = z.object({
  category: z.enum([
    "income",
    "cost_of_goods",
    "payroll",
    "rent",
    "utilities",
    "marketing",
    "transport",
    "other_expense",
    "transfer",
    "uncategorized",
  ]),
});

export type RecategorizeFormValues = z.infer<typeof recategorizeSchema>;
