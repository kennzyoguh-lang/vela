"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { decodeAccessTokenClaims } from "@/lib/auth/decode-access-token";
import { Button } from "@/components/ui/Button";

type GraduationFactor = "hasSalesStaff" | "customerPattern";
type GraduationValue = "yes" | "repeat";

interface GraduationPrompt {
  factor: GraduationFactor;
  suggestedValue: GraduationValue;
  reason: string;
}

// Piece 4 — usage contradicting a stored onboarding factor (e.g. a 2nd staff
// account while hasSalesStaff=no) never changes the factor itself; it only
// surfaces here for the owner to explicitly confirm one factor at a time.
// "Not now" is deliberately session-only (component state, not persisted) —
// the spec never asked for a permanent dismissal, and the prompt is cheap
// to re-derive from current usage on the next visit if still true.
export function GraduationPromptBanner() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = accessToken ? decodeAccessTokenClaims(accessToken)?.role : null;
  const isOwnerOrAdmin = role === "owner" || role === "admin";
  const [dismissed, setDismissed] = useState<Set<GraduationFactor>>(new Set());

  const { data: prompts } = useQuery({
    queryKey: ["business-profile", "graduation-prompts"],
    queryFn: () =>
      api.get<GraduationPrompt[]>("/v1/organisation/business-profile/graduation-prompts"),
    enabled: isOwnerOrAdmin,
    staleTime: 60_000,
  });

  const confirmMutation = useMutation({
    mutationFn: (prompt: GraduationPrompt) =>
      api.patch("/v1/organisation/business-profile/graduation-prompt", {
        factor: prompt.factor,
        value: prompt.suggestedValue,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-profile"] });
    },
  });

  const visiblePrompts = (prompts ?? []).filter((p) => !dismissed.has(p.factor));
  if (!isOwnerOrAdmin || visiblePrompts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visiblePrompts.map((prompt) => (
        <div
          key={prompt.factor}
          className="bg-gold/10 border-gold/30 flex items-center gap-3 rounded-2xl border px-5 py-4"
        >
          <Sparkles className="text-gold size-6 shrink-0" aria-hidden />
          <p className="font-ui text-text-primary flex-1 text-[0.9375rem] font-semibold">
            {prompt.reason}
          </p>
          <Button
            size="sm"
            loading={
              confirmMutation.isPending && confirmMutation.variables?.factor === prompt.factor
            }
            onClick={() => confirmMutation.mutate(prompt)}
          >
            Yes, update
          </Button>
          <button
            type="button"
            aria-label="Not now"
            onClick={() => setDismissed((prev) => new Set(prev).add(prompt.factor))}
            className="text-text-secondary hover:text-text-primary shrink-0"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
