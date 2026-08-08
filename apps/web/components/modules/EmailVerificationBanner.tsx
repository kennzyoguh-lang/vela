"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";

interface CurrentUserSummary {
  email: string | null;
  emailVerifiedAt: string | null;
}

// Dismissible for the session only (component state, not persisted) — same
// "cheap to re-derive, don't need a permanent dismissal flag" reasoning as
// GraduationPromptBanner. Never hidden for a phone+PIN staff user (email
// null) — they have nothing to verify, so emailVerifiedAt/email both null
// simply never renders a banner (the `user.email` check below), not a
// special-cased role check.
export function EmailVerificationBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [justSent, setJustSent] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<CurrentUserSummary>("/v1/auth/me"),
    staleTime: 30_000,
  });

  const resendMutation = useMutation({
    mutationFn: () => api.post("/v1/auth/resend-verification"),
    onSuccess: () => setJustSent(true),
  });

  if (dismissed || !user?.email || user.emailVerifiedAt) return null;

  return (
    <Alert variant="warning" title="Confirm your email address">
      <span className="flex flex-wrap items-center gap-3">
        {justSent
          ? "We've sent a new confirmation link — check your inbox."
          : `We sent a confirmation link to ${user.email}.`}
        <Button
          size="sm"
          variant="secondary"
          loading={resendMutation.isPending}
          disabled={justSent}
          onClick={() => resendMutation.mutate()}
        >
          Resend
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="font-ui text-[0.875rem] underline"
        >
          Dismiss
        </button>
      </span>
    </Alert>
  );
}
