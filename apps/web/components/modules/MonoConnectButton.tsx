"use client";

import { useState } from "react";
import Script from "next/script";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { api, ApiError } from "@/lib/api/client";

const MONO_PUBLIC_KEY = process.env.NEXT_PUBLIC_MONO_PUBLIC_KEY;

interface MonoConnectInstance {
  setup(): void;
  open(): void;
}

interface MonoConnectConstructor {
  new (config: {
    key: string;
    onSuccess: (result: { code: string }) => void;
    onClose?: () => void;
  }): MonoConnectInstance;
}

declare global {
  interface Window {
    MonoConnect?: MonoConnectConstructor;
  }
}

// Mono Connect (Handbook 10.3-style provider integration, Phase 4's bank-sync
// equivalent of Paystack's checkout). NEXT_PUBLIC_MONO_PUBLIC_KEY unset shows
// an honest "not configured yet" state rather than a broken button — same
// contract as the backend's MONO_SECRET_KEY (Handbook 1.4).
export function MonoConnectButton() {
  const queryClient = useQueryClient();
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkMutation = useMutation({
    mutationFn: (code: string) => api.post("/v1/bank-accounts/link", { provider: "mono", code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't link that account."),
  });

  function openConnect() {
    if (!MONO_PUBLIC_KEY || !window.MonoConnect) return;
    const connect = new window.MonoConnect({
      key: MONO_PUBLIC_KEY,
      onSuccess: ({ code }) => linkMutation.mutate(code),
    });
    connect.setup();
    connect.open();
  }

  if (!MONO_PUBLIC_KEY) {
    return (
      <Alert variant="info" title="Bank sync isn't configured yet">
        Add a Mono sandbox public key to enable connecting a bank account.
      </Alert>
    );
  }

  return (
    <>
      <Script
        src="https://connect.mono.co/connect.js"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      {error ? <Alert variant="danger" title={error} /> : null}
      <Button onClick={openConnect} disabled={!scriptReady} loading={linkMutation.isPending}>
        Connect bank account
      </Button>
    </>
  );
}
