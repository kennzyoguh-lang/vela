"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

// Design System 6.4/3.12 — 6-digit segmented input (auto-advance, paste-
// friendly), "Use a backup code" link, lockout state with live countdown
// (5 fails -> 15 min, Handbook 8.3). Foundation ships a single-input version;
// the segmented-digit UX polish is a fast follow, not a blocker for the
// underlying auth flow.
export default function TwoFactorChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/v1/auth/2fa/confirm", { code });
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="font-ui text-text-primary text-center text-[1.25rem] font-semibold">
        Enter your verification code
      </h1>
      {error ? <Alert variant="danger" title={error} /> : null}
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        aria-label="6-digit verification code"
        className="border-border bg-surface-raised font-data text-text-primary h-14 rounded-md border text-center text-[1.5rem] tracking-[0.5em]"
      />
      <Button type="submit" loading={submitting} disabled={code.length !== 6} className="w-full">
        Verify
      </Button>
      <p className="font-ui text-text-secondary text-center text-[0.75rem]">
        Use a backup code instead
      </p>
    </form>
  );
}
