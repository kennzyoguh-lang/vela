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
