import { z } from "zod";

const TRANSACTION_CATEGORIES = [
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
] as const;

// Mirrors apps/web/lib/validation/bank-sync.schema.ts.
export const linkAccountSchema = z.object({
  provider: z.enum(["mono", "okra"]).default("mono"),
  code: z.string().min(1),
});

export const recategorizeSchema = z.object({
  category: z.enum(TRANSACTION_CATEGORIES),
});

export const pnlRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export type LinkAccountInput = z.infer<typeof linkAccountSchema>;
export type RecategorizeInput = z.infer<typeof recategorizeSchema>;
export type PnlRangeInput = z.infer<typeof pnlRangeSchema>;
