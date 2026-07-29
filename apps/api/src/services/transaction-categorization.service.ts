import type { TransactionCategory, TransactionType } from "@prisma/client";

// One documented, testable keyword-matching function — same "start simple,
// not ML" precedent as invoice-risk.service.ts and
// compliance-obligation-rules.ts. Case-insensitive substring match against
// the transaction narration; the first matching rule wins. A miscategorized
// transaction is always manually correctable (bank-transaction.service.ts's
// recategorizeTransaction), and a manual correction is never touched by a
// later sync (upsertTransaction only inserts new rows, never updates an
// existing one's category).
const CATEGORY_KEYWORDS: Array<{ category: TransactionCategory; keywords: string[] }> = [
  { category: "payroll", keywords: ["salary", "payroll", "wages"] },
  { category: "rent", keywords: ["rent", "lease"] },
  {
    category: "utilities",
    keywords: ["nepa", "phcn", "electricity", "power bill", "water bill", "internet", "data sub"],
  },
  {
    category: "marketing",
    keywords: ["ads", "advert", "facebook ads", "google ads", "marketing", "promo"],
  },
  { category: "transport", keywords: ["uber", "bolt", "fuel", "diesel", "transport", "logistics"] },
  { category: "transfer", keywords: ["transfer to own", "self transfer", "wallet funding"] },
  {
    category: "cost_of_goods",
    keywords: ["supplier", "inventory", "stock purchase", "raw material", "wholesale"],
  },
];

// Credits default to income (a payment received) unless a keyword says
// otherwise; debits with no keyword match stay uncategorized rather than
// guessing wrong — Design System's canonical status map already treats
// "uncategorized" as a visible, actionable state, not a hidden default.
export function categorizeTransaction(
  narration: string,
  type: TransactionType,
): TransactionCategory {
  const normalized = narration.toLowerCase();
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) return rule.category;
  }
  return type === "credit" ? "income" : "uncategorized";
}
