import { z } from "zod";

// Same shape as FirsPenaltyInput (firs-penalty-calculator.ts) plus the two
// lead-capture fields — kept in sync manually since one is a Zod schema and
// the other a plain TS interface, same split as every other validation
// schema in this codebase.
export const recordCalculatorLeadSchema = z.object({
  email: z.string().email(),
  businessName: z.string().min(1).max(200),
  lastVatFiledAt: z.string().datetime().nullable(),
  monthlyVat: z.number().nonnegative(),
  lastWhtRemittedAt: z.string().datetime().nullable(),
  monthlyWht: z.number().nonnegative(),
  citLastFiledYear: z.number().int().nullable(),
  monthlyCit: z.number().nonnegative(),
});

export type RecordCalculatorLeadInput = z.infer<typeof recordCalculatorLeadSchema>;
