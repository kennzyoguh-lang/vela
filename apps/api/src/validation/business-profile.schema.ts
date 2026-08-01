import { z } from "zod";
import { MODULE_KEYS } from "@vela/types";

// The three onboarding factors — each a genuine three-way answer, never a
// forced binary. See packages/types/src/business-profile.ts for why.
export const setBusinessProfileFactorsSchema = z.object({
  customerPattern: z.enum(["one_time", "repeat", "unsure"]),
  hasSalesStaff: z.enum(["yes", "no", "unsure"]),
  isCacRegistered: z.enum(["yes", "no", "unsure"]),
});

export type SetBusinessProfileFactorsInput = z.infer<typeof setBusinessProfileFactorsSchema>;

// Requirement 4 — a manual per-module override. `value: null` clears it,
// reverting that module to its computed default.
export const setModuleOverrideSchema = z.object({
  moduleKey: z.enum(MODULE_KEYS as [string, ...string[]]),
  value: z.boolean().nullable(),
});

export type SetModuleOverrideInput = z.infer<typeof setModuleOverrideSchema>;

// Graduation prompts (piece 4) — confirming ONE suggested factor update at a
// time, never a full re-onboarding. The factor/value pairing is validated
// again in the service (business-profile.service.ts#confirmGraduationPrompt)
// since a discriminated union here would still let a client send a
// mismatched pair (e.g. factor "hasSalesStaff" with value "repeat") that
// zod's own type-checking can't catch from these two independent enums.
export const confirmGraduationPromptSchema = z.object({
  factor: z.enum(["hasSalesStaff", "customerPattern"]),
  value: z.enum(["yes", "repeat"]),
});

export type ConfirmGraduationPromptInput = z.infer<typeof confirmGraduationPromptSchema>;
