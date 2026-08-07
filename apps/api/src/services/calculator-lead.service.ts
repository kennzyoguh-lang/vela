import * as calculatorLeadRepo from "../repositories/calculator-lead.repository";
import { calculateFirsPenalties, type FirsPenaltyInput } from "@vela/types";

export interface RecordLeadInput extends FirsPenaltyInput {
  email: string;
  businessName: string;
}

// Recomputes the penalty totals server-side from the same inputs the
// visitor entered, rather than trusting client-sent totals — the number
// stored here can never drift from calculateFirsPenalties' own formula
// (same "shared pure function, never trust a client-computed total"
// precedent as business-profile's server-computed status).
export async function recordLead(input: RecordLeadInput) {
  const penalties = calculateFirsPenalties(input);
  return calculatorLeadRepo.createLead({
    email: input.email,
    businessName: input.businessName,
    vatPenalty: penalties.vat.totalToDate,
    whtPenalty: penalties.wht.totalToDate,
    citPenalty: penalties.cit.totalToDate,
    totalPenalty: penalties.totalPenalty,
  });
}

// Called from auth.service.ts#signup — closes the loop so
// waitlist_to_paid-style conversion rate can be computed on read later
// (Channel 9). Never allowed to fail a signup: a missing/stale lead row is
// just a metric gap, not a reason to reject a real account creation.
export async function markConverted(email: string): Promise<void> {
  await calculatorLeadRepo.markConverted(email);
}
