import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { NotFoundError } from "../lib/errors";

/**
 * Nigeria Tax Act 2025, Section 56 (effective 1 January 2026) — a "small
 * company" (turnover at or below this threshold, fixed assets at or below
 * the other, and not a professional-services provider) pays 0% Companies
 * Income Tax, 0% Capital Gains Tax, and is exempt from the Development
 * Levy. Every other company pays a flat 30% CIT. These are the only two
 * numbers this module hardcodes — see paye-calculator.ts for the same
 * "one documented formula" precedent.
 */
export const SMALL_COMPANY_TURNOVER_THRESHOLD = 50_000_000;
export const SMALL_COMPANY_FIXED_ASSETS_THRESHOLD = 250_000_000;
export const STANDARD_CIT_RATE = 0.3;
export const SMALL_COMPANY_CIT_RATE = 0;

export type SmallCompanyStatus = "small" | "standard" | "unknown";

export interface TaxProfileInput {
  annualTurnover: number | null;
  fixedAssetsValue: number | null;
  providesProfessionalServices: boolean | null;
}

/**
 * "unknown" (never guessed) until all three inputs are supplied. A
 * professional-services provider is excluded from small-company status
 * regardless of size — checked first so an owner can't accidentally read
 * "small" from a turnover/assets check alone.
 */
export function computeSmallCompanyStatus(input: TaxProfileInput): SmallCompanyStatus {
  if (
    input.annualTurnover === null ||
    input.fixedAssetsValue === null ||
    input.providesProfessionalServices === null
  ) {
    return "unknown";
  }
  if (input.providesProfessionalServices) return "standard";
  if (
    input.annualTurnover <= SMALL_COMPANY_TURNOVER_THRESHOLD &&
    input.fixedAssetsValue <= SMALL_COMPANY_FIXED_ASSETS_THRESHOLD
  ) {
    return "small";
  }
  return "standard";
}

export function citRateFor(status: SmallCompanyStatus): number | null {
  if (status === "unknown") return null;
  return status === "small" ? SMALL_COMPANY_CIT_RATE : STANDARD_CIT_RATE;
}

/**
 * Plain-language summary for the compliance UI — always paired with a
 * disclaimer at the call site (never presented as final tax advice; the
 * VAT small-business threshold in particular is NOT covered here because
 * it couldn't be confirmed against an authoritative source at the time
 * this was written — see the PR/commit note).
 */
export function describeTaxStatus(status: SmallCompanyStatus): string {
  switch (status) {
    case "small":
      return "You appear to qualify as a Small Company under the Nigeria Tax Act 2025 — 0% Companies Income Tax, 0% Capital Gains Tax, and exempt from the Development Levy.";
    case "standard":
      return "You don't currently qualify as a Small Company under the Nigeria Tax Act 2025 — the standard 30% Companies Income Tax rate applies.";
    case "unknown":
      return "Tell us your annual turnover, fixed assets, and whether you provide professional services to see your Companies Income Tax status under the Nigeria Tax Act 2025.";
  }
}

export interface TaxStatus extends TaxProfileInput {
  status: SmallCompanyStatus;
  citRate: number | null;
  summary: string;
}

export async function getTaxStatus(orgId: string): Promise<TaxStatus> {
  const org = await organisationRepo.findOrganisationById(orgId);
  if (!org) throw new NotFoundError("Organisation not found");

  const input: TaxProfileInput = {
    annualTurnover: org.annualTurnover === null ? null : Number(org.annualTurnover),
    fixedAssetsValue: org.fixedAssetsValue === null ? null : Number(org.fixedAssetsValue),
    providesProfessionalServices: org.providesProfessionalServices,
  };
  const status = computeSmallCompanyStatus(input);

  return {
    ...input,
    status,
    citRate: citRateFor(status),
    summary: describeTaxStatus(status),
  };
}

export async function setTaxProfile(orgId: string, actorId: string, profile: TaxProfileInput) {
  await organisationRepo.setTaxProfile(orgId, profile);

  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "organisation.tax_profile_set",
    entityType: "organisation",
    entityId: orgId,
    newValue: profile,
  });
}
