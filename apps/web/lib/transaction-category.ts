import type { TransactionCategory } from "@vela/types";
import type { BadgeStatus } from "@/components/ui/Badge";

// Design System 4.14's canonical status map reused here for a signal, not a
// lifecycle: income stands out (sage), an uncategorized transaction is
// flagged for attention (rust), everything else is a plain categorized
// expense (neutral) — Badge stays generic/reusable, this is the one place
// that translates (same approach as lib/invoice-status.ts).
const CATEGORY_TO_BADGE: Record<TransactionCategory, BadgeStatus> = {
  income: "active",
  uncategorized: "overdue",
  cost_of_goods: "draft",
  payroll: "draft",
  rent: "draft",
  utilities: "draft",
  marketing: "draft",
  transport: "draft",
  other_expense: "draft",
  transfer: "archived",
};

const CATEGORY_LABEL: Record<TransactionCategory, string> = {
  income: "Income",
  cost_of_goods: "Cost of goods",
  payroll: "Payroll",
  rent: "Rent",
  utilities: "Utilities",
  marketing: "Marketing",
  transport: "Transport",
  other_expense: "Other expense",
  transfer: "Transfer",
  uncategorized: "Uncategorized",
};

export const RECATEGORIZABLE_CATEGORIES: TransactionCategory[] = [
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
];

export function categoryBadgeStatus(category: TransactionCategory): BadgeStatus {
  return CATEGORY_TO_BADGE[category];
}

export function categoryLabel(category: TransactionCategory): string {
  return CATEGORY_LABEL[category];
}
