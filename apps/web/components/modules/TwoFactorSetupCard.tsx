"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { PaymentQrCode } from "@/components/pos/PaymentQrCode";
import { api, ApiError } from "@/lib/api/client";

// Same shape auth.service.ts#CurrentUserSummary returns from /v1/auth/me —
// duplicated locally rather than shared, matching EmailVerificationBanner's
// existing precedent for this same endpoint (no shared-types package entry
// for it yet).
interface CurrentUserSummary {
  email: string | null;
  role: string;
  twoFaEnabled: boolean;
}

type Step = "idle" | "scan" | "backup-codes";

// F-60 — TOTP enrollment. Mandatory for the Owner role (Handbook 8.3), but
// nothing server-side currently blocks an un-enrolled Owner from using the
// app (that gate doesn't exist yet); this card is what makes enrollment
// actually possible at all, which is the prerequisite for a future
// mandatory-gate to have anywhere to send someone.
export function TwoFactorSetupCard() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("idle");
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  // Design System 3.12's explicit gate — backup codes are shown exactly
  // once (they're hashed, non-retrievable after) and the flow can't be
  // dismissed until the user affirms they've actually saved them.
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  const {
    data: user,
    isLoading,
    error: userError,
  } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<CurrentUserSummary>("/v1/auth/me"),
    staleTime: 30_000,
  });

  const setupMutation = useMutation({
    mutationFn: () =>
      api.post<{ secret: string; uri: string }>("/v1/auth/2fa/setup", { email: user?.email }),
    onSuccess: (data) => {
      setSecret(data.secret);
      setUri(data.uri);
      setStep("scan");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.post<{ backupCodes: string[] }>("/v1/auth/2fa/confirm", { secret, code }),
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      setStep("backup-codes");
      setCode("");
    },
  });

  function finishAndReset() {
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    setStep("idle");
    setSavedConfirmed(false);
    setSecret("");
    setUri("");
    setBackupCodes([]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
      </CardHeader>

      {isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : userError ? (
        <p className="font-ui text-status-danger text-[0.875rem]">
          Couldn&apos;t load your account — try again shortly.
        </p>
      ) : user?.twoFaEnabled ? (
        <Alert variant="info" title="Two-factor authentication is enabled on your account" />
      ) : step === "idle" ? (
        <div className="flex flex-col gap-3">
          <p className="font-ui text-text-secondary text-[0.875rem]">
            {user?.role === "owner"
              ? "Mandatory for the Owner role (Handbook 8.3) — scan a QR code with an authenticator app (Google Authenticator, Authy) to turn it on."
              : "Optional, but strongly recommended — scan a QR code with an authenticator app (Google Authenticator, Authy) to turn it on."}
          </p>
          <Button
            onClick={() => setupMutation.mutate()}
            loading={setupMutation.isPending}
            className="self-start"
          >
            Enable 2FA
          </Button>
          {setupMutation.isError ? (
            <Alert
              variant="danger"
              title={
                setupMutation.error instanceof ApiError
                  ? setupMutation.error.message
                  : "Couldn't start 2FA setup"
              }
            />
          ) : null}
        </div>
      ) : step === "scan" ? (
        <div className="flex flex-col items-start gap-4">
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Scan this code with your authenticator app, then enter the 6-digit code it shows.
          </p>
          <PaymentQrCode value={uri} label="2FA setup QR code" />
          <p className="font-ui text-text-secondary text-[0.75rem]">
            Can&apos;t scan?{" "}
            <span className="font-data text-text-primary tracking-wide">{secret}</span> — enter this
            manually instead.
          </p>
          <form
            className="flex items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              confirmMutation.mutate();
            }}
          >
            <Input
              label="6-digit code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <Button type="submit" loading={confirmMutation.isPending} disabled={code.length !== 6}>
              Confirm
            </Button>
          </form>
          {confirmMutation.isError ? (
            <Alert
              variant="danger"
              title={
                confirmMutation.error instanceof ApiError
                  ? confirmMutation.error.message
                  : "Couldn't verify that code"
              }
            />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Alert variant="warning" title="Save these backup codes now — you won't see them again">
            Each one lets you sign in once if you lose access to your authenticator app.
          </Alert>
          <ul className="font-data grid grid-cols-2 gap-2 rounded-md border p-4 tracking-wide">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <label className="font-ui text-text-primary flex items-center gap-2 text-[0.875rem]">
            <input
              type="checkbox"
              checked={savedConfirmed}
              onChange={(e) => setSavedConfirmed(e.target.checked)}
            />
            I&apos;ve saved these backup codes somewhere safe
          </label>
          <Button onClick={finishAndReset} disabled={!savedConfirmed} className="self-start">
            Done
          </Button>
        </div>
      )}
    </Card>
  );
}
