import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as userRepo from "../repositories/user.repository";
import * as saleRepo from "../repositories/sale.repository";
import { NotFoundError, BusinessRuleViolationError } from "../lib/errors";
import { MODULE_KEYS, type ModuleKey } from "@vela/types";
import type {
  SetBusinessProfileFactorsInput,
  ConfirmGraduationPromptInput,
} from "../validation/business-profile.schema";

// A staff/customer count contradicting a "no"/"one_time" answer this many
// times over is treated as a genuine graduation signal, not noise from a
// single one-off hire or repeat walk-in — matches the spec's own examples
// ("2nd staff account", "3+ times").
const STAFF_GRADUATION_THRESHOLD = 2;
const REPEAT_CUSTOMER_GRADUATION_THRESHOLD = 3;

export type GraduationPrompt =
  | { factor: "hasSalesStaff"; suggestedValue: "yes"; reason: string }
  | { factor: "customerPattern"; suggestedValue: "repeat"; reason: string };

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

/**
 * Detects real usage contradicting a stored factor — never re-derives the
 * whole profile, never changes anything itself. Only checks the two factors
 * usage can actually reveal (staff headcount, repeat-customer behavior);
 * Factor C (CAC registration) isn't something usage patterns can contradict,
 * so it's deliberately absent from this check.
 */
export async function getGraduationPrompts(orgId: string): Promise<GraduationPrompt[]> {
  const factors = await getBusinessProfile(orgId);
  const prompts: GraduationPrompt[] = [];

  if (factors.hasSalesStaff === "no") {
    const staffCount = await userRepo.countActiveStaffRole(orgId);
    if (staffCount >= STAFF_GRADUATION_THRESHOLD) {
      prompts.push({
        factor: "hasSalesStaff",
        suggestedValue: "yes",
        reason: `You've added ${staffCount} sales staff accounts — want to turn on cash reconciliation?`,
      });
    }
  }

  if (factors.customerPattern === "one_time") {
    const hasRepeatCustomer = await saleRepo.hasRepeatCustomer(
      orgId,
      REPEAT_CUSTOMER_GRADUATION_THRESHOLD,
    );
    if (hasRepeatCustomer) {
      prompts.push({
        factor: "customerPattern",
        suggestedValue: "repeat",
        reason:
          "Some of your customers keep coming back — want to turn on invoicing and low-stock alerts?",
      });
    }
  }

  return prompts;
}

/**
 * Confirms exactly ONE suggested factor update — the other two factors are
 * read from current state and re-sent unchanged, never re-derived or reset.
 * A distinct audit action from setBusinessProfileFactors so the trail shows
 * this was a graduation confirmation, not the owner re-answering onboarding.
 */
export async function confirmGraduationPrompt(
  orgId: string,
  actorId: string,
  input: ConfirmGraduationPromptInput,
) {
  if (input.factor === "hasSalesStaff" && input.value !== "yes") {
    throw new BusinessRuleViolationError(`Invalid value "${input.value}" for factor hasSalesStaff`);
  }
  if (input.factor === "customerPattern" && input.value !== "repeat") {
    throw new BusinessRuleViolationError(
      `Invalid value "${input.value}" for factor customerPattern`,
    );
  }

  const current = await getBusinessProfile(orgId);
  // The two throws above already guarantee value/factor are a valid pair —
  // these casts just restate that for the compiler, which can't narrow
  // `value` from `factor` across two independent zod enums. Built explicitly
  // (not spread from `current`) so only the three factor keys reach the
  // repository — `current` also carries moduleOverrides/
  // profileFactorsConfirmedAt, which this call must never touch.
  const factors: SetBusinessProfileFactorsInput = {
    customerPattern:
      input.factor === "customerPattern" ? (input.value as "repeat") : current.customerPattern,
    hasSalesStaff:
      input.factor === "hasSalesStaff" ? (input.value as "yes") : current.hasSalesStaff,
    isCacRegistered: current.isCacRegistered,
  };

  await organisationRepo.setBusinessProfileFactors(orgId, factors);

  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "organisation.graduation_confirmed",
    entityType: "organisation",
    entityId: orgId,
    newValue: { factor: input.factor, value: input.value },
  });
}
