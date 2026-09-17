import { z } from "zod";

// Same category list bank-sync.schema.ts recategorizes a transaction into,
// minus "income"/"transfer"/"uncategorized" — none of those are things an
// expense claim can plausibly be ("I spent money on income" isn't a real
// claim), so they're excluded here rather than accepted and rejected later.
const EXPENSE_CLAIM_CATEGORIES = [
  "cost_of_goods",
  "payroll",
  "rent",
  "utilities",
  "marketing",
  "transport",
  "other_expense",
] as const;

export const submitExpenseClaimSchema = z.object({
  category: z.enum(EXPENSE_CLAIM_CATEGORIES),
  vendor: z.string().min(1).max(200),
  amount: z.number().positive(),
  currency: z.string().length(3).default("NGN"),
  expenseDate: z.coerce.date(),
  description: z.string().max(500).optional(),
  receiptFileId: z.string().uuid().optional(),
});

export const rejectExpenseClaimSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type SubmitExpenseClaimInput = z.infer<typeof submitExpenseClaimSchema>;
