import { z } from "zod";

// Fixed option sets, matching the dropdowns on the public waitlist page
// (apps/web/app/waitlist/page.tsx) — "problem" drives server-side segment
// derivation (waitlist.service.ts#deriveSegment), so its values are a closed
// set, not free text.
export const WAITLIST_PROBLEM_OPTIONS = [
  "walk_in_sales_cash_theft",
  "invoicing_late_payments",
  "compliance_tax_filing",
  "bookkeeping_cashflow",
  "other",
] as const;

export const WAITLIST_REVENUE_RANGE_OPTIONS = ["under_1m", "1m_5m", "5m_20m", "over_20m"] as const;

export const joinWaitlistSchema = z.object({
  businessName: z.string().min(1).max(200),
  ownerName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(20).nullable(),
  revenueRange: z.enum(WAITLIST_REVENUE_RANGE_OPTIONS),
  problem: z.enum(WAITLIST_PROBLEM_OPTIONS),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
