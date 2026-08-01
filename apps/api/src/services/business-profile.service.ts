import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { NotFoundError, BusinessRuleViolationError } from "../lib/errors";
import { MODULE_KEYS, type ModuleKey } from "@vela/types";
import type { SetBusinessProfileFactorsInput } from "../validation/business-profile.schema";

/**
 * Raw factors + overrides only — never a pre-computed visibility map or
 * label. Every consumer (web app, any future consumer) computes those
 * itself via the shared pure functions in @vela/types, from this same raw
 * source of truth, so there's exactly one place the algorithm can drift.
 */
export async function getBusinessProfile(orgId: string) {
  const org = await organisationRepo.findOrganisationById(orgId);
  if (!org) throw new NotFoundError("Organisation not found");

  return {
    customerPattern: org.customerPattern,
    hasSalesStaff: org.hasSalesStaff,
    isCacRegistered: org.isCacRegistered,
    moduleOverrides: org.moduleOverrides as Partial<Record<ModuleKey, boolean>>,
    profileFactorsConfirmedAt: org.profileFactorsConfirmedAt,
  };
}

export async function setBusinessProfileFactors(
  orgId: string,
  actorId: string,
  factors: SetBusinessProfileFactorsInput,
) {
  await organisationRepo.setBusinessProfileFactors(orgId, factors);

  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "organisation.business_profile_factors_set",
    entityType: "organisation",
    entityId: orgId,
    newValue: factors,
  });
}

export async function setModuleOverride(
  orgId: string,
  actorId: string,
  moduleKey: string,
  value: boolean | null,
) {
  if (!MODULE_KEYS.includes(moduleKey as ModuleKey)) {
    throw new BusinessRuleViolationError(`Unknown module: ${moduleKey}`);
  }

  await organisationRepo.setModuleOverride(orgId, moduleKey, value);

  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "organisation.module_override_set",
    entityType: "organisation",
    entityId: orgId,
    newValue: { moduleKey, value },
  });
}
