"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/Alert";

type Status = "verifying" | "success" | "error";

// Public route (middleware.ts's PUBLIC_PATHS, not AUTH_PATHS) — a freshly
// signed-up visitor already has a session at this point (auth.service.ts#signup
// issues one immediately), so this must NOT be in AUTH_PATHS, which redirects
// an already-authenticated visitor away before the token ever gets verified.
export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    if (!token) {
      setStatus("error");
      setError("This verification link is missing its token.");
      return;
    }

    api
      .post("/v1/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "Verification link expired or invalid.");
      });
  }, [token]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-ui text-text-primary text-center text-[1.25rem] font-semibold">
        Confirm your email
      </h1>
      {status === "verifying" ? (
        <p className="font-ui text-text-secondary text-center text-[0.875rem]">Verifying…</p>
      ) : null}
      {status === "success" ? (
        <Alert variant="info" title="Email confirmed">
          Your email address is now verified.
        </Alert>
      ) : null}
      {status === "error" ? (
        <Alert variant="danger" title={error ?? "Verification failed"}>
          Request a new link from the Resend option on your dashboard.
        </Alert>
      ) : null}
      <Link
        href="/"
        className="bg-action-primary text-action-primaryText font-ui duration-quick inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-4 text-[1rem] font-semibold transition-transform hover:brightness-95 active:scale-[0.98]"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
