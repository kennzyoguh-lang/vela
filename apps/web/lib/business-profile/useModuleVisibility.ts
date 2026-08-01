"use client";

import { useQuery } from "@tanstack/react-query";
import {
  computeModuleDefaults,
  applyModuleOverrides,
  type BusinessProfileFactors,
  type ModuleOverrides,
  type ModuleVisibility,
} from "@vela/types";
import { api } from "@/lib/api/client";

export interface BusinessProfileResponse extends BusinessProfileFactors {
  moduleOverrides: ModuleOverrides;
  profileFactorsConfirmedAt: string | null;
}

// The one place every UI surface (sidebar, dashboard widgets, POS buttons)
// asks "should this module show?" — always computed fresh from the raw
// factors + overrides via the shared pure functions in @vela/types, never
// duplicated or cached separately, so there's exactly one algorithm to keep
// correct. Falls back to the safe, inclusive-middle-ground defaults
// (Example 5) while the profile hasn't loaded yet, rather than flashing
// "everything hidden" for a moment.
export function useModuleVisibility(): { visibility: ModuleVisibility; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["business-profile"],
    queryFn: () => api.get<BusinessProfileResponse>("/v1/organisation/business-profile"),
    staleTime: 60_000,
  });

  const factors: BusinessProfileFactors = data ?? {
    customerPattern: "unsure",
    hasSalesStaff: "unsure",
    isCacRegistered: "unsure",
  };
  const defaults = computeModuleDefaults(factors);
  const visibility = applyModuleOverrides(defaults, data?.moduleOverrides ?? {});

  return { visibility, isLoading };
}
