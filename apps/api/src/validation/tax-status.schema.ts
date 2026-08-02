import { z } from "zod";

// Nigeria Tax Act 2025 small-company status inputs — all three required
// together (answered as one short form), each a plain number/boolean since,
// unlike business profiling's factors, there's no "unsure" state that means
// anything here: an owner either knows these figures or hasn't told us yet
// (tax-status.service.ts's "unknown" status covers the latter).
export const setTaxProfileSchema = z.object({
  annualTurnover: z.number().nonnegative(),
  fixedAssetsValue: z.number().nonnegative(),
  providesProfessionalServices: z.boolean(),
});

export type SetTaxProfileInput = z.infer<typeof setTaxProfileSchema>;
