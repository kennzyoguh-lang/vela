"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { decodeAccessTokenClaims } from "@/lib/auth/decode-access-token";

interface BusinessProfileResponse {
  profileFactorsConfirmedAt: string | null;
}

// Catches every path back to the dashboard that ISN'T "just signed up"
// (signup already redirects straight to /onboarding): a returning owner who
// hit "Skip for now" and never came back, and every org that existed before
// this feature shipped (profileFactorsConfirmedAt is null by default for
// all of them). Only owner/admin ever get redirected — staff can't set
// factors anyway (route is owner/admin-gated), so prompting them would be a
// dead end.
export function OnboardingGate() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = accessToken ? decodeAccessTokenClaims(accessToken)?.role : null;
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  const { data } = useQuery({
    queryKey: ["business-profile", "onboarding-gate"],
    queryFn: () => api.get<BusinessProfileResponse>("/v1/organisation/business-profile"),
    enabled: isOwnerOrAdmin,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isOwnerOrAdmin && data && data.profileFactorsConfirmedAt === null) {
      router.replace("/onboarding");
    }
  }, [isOwnerOrAdmin, data, router]);

  return null;
}
