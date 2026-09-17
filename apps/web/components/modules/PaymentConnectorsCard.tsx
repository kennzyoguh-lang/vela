"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaymentCredentialSummary, PaymentProcessor } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api/client";

const PROCESSORS: { value: PaymentProcessor; label: string; live: boolean }[] = [
  { value: "paystack", label: "Paystack", live: true },
  { value: "flutterwave", label: "Flutterwave", live: false },
  { value: "stripe", label: "Stripe", live: false },
];

function ConnectForm({
  processor,
  onConnected,
}: {
  processor: PaymentProcessor;
  onConnected: () => void;
}) {
  const [secretKey, setSecretKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<PaymentCredentialSummary>("/v1/payment-credentials", {
        processor,
        secretKey,
        publicKey: publicKey || undefined,
      }),
    onSuccess: () => {
      setSecretKey("");
      setPublicKey("");
      onConnected();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't connect."),
  });

  return (
    <form
      className="border-border flex flex-col gap-3 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
    >
      {error ? <Alert variant="danger" title={error} /> : null}
      <Input
        label="Secret key"
        type="password"
        value={secretKey}
        onChange={(e) => setSecretKey(e.target.value)}
        helperText="Encrypted at rest — never shown again once saved"
        required
      />
      <Input
        label="Public key (optional)"
        value={publicKey}
        onChange={(e) => setPublicKey(e.target.value)}
      />
      <Button
        type="submit"
        size="sm"
        className="self-start"
        loading={mutation.isPending}
        disabled={!secretKey.trim()}
      >
        Connect
      </Button>
    </form>
  );
}

// F-connectors — bring-your-own payment processor. A business that already
// has its own Paystack/Stripe/Flutterwave merchant account can connect it
// here so customer payments settle directly into THAT account instead of
// Vela's own platform one; the org's key is encrypted at rest
// (payment-credential.service.ts) and never sent back to any client after
// it's saved.
export function PaymentConnectorsCard() {
  const queryClient = useQueryClient();
  const [openForm, setOpenForm] = useState<PaymentProcessor | null>(null);

  const { data: connections, isLoading } = useQuery({
    queryKey: ["payment-credentials"],
    queryFn: () => api.get<PaymentCredentialSummary[]>("/v1/payment-credentials"),
    staleTime: 30_000,
  });

  const disconnectMutation = useMutation({
    mutationFn: (processor: PaymentProcessor) => api.delete(`/v1/payment-credentials/${processor}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-credentials"] }),
  });

  function invalidate() {
    setOpenForm(null);
    queryClient.invalidateQueries({ queryKey: ["payment-credentials"] });
  }

  const connectionByProcessor = new Map(
    (connections ?? []).filter((c) => c.isActive).map((c) => [c.processor, c]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment processors</CardTitle>
      </CardHeader>
      <p className="font-ui text-text-secondary text-[0.875rem]">
        Already have your own Paystack, Flutterwave, or Stripe account? Connect it so customer
        payments settle directly into it instead of Vela's own account.
      </p>
      {isLoading ? (
        <Skeleton className="mt-3 h-12 w-full" />
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {PROCESSORS.map(({ value, label, live }) => {
            const connection = connectionByProcessor.get(value);
            return (
              <div key={value} className="border-border rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="font-ui text-text-primary text-[0.875rem] font-semibold">
                      {label}
                    </p>
                    {connection ? (
                      <Badge status="active" label="Connected" />
                    ) : (
                      <Badge status="draft" label="Not connected" />
                    )}
                    {!live ? <Badge status="archived" label="Coming soon" /> : null}
                  </div>
                  {connection ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={disconnectMutation.isPending}
                      onClick={() => disconnectMutation.mutate(value)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setOpenForm(openForm === value ? null : value)}
                    >
                      {openForm === value ? "Cancel" : "Connect"}
                    </Button>
                  )}
                </div>
                {!live ? (
                  <p className="font-ui text-text-secondary mt-1 text-[0.75rem]">
                    You can save credentials now, but live charges through {label} aren&apos;t
                    supported yet — Paystack is the only processor Vela can actually charge through
                    today.
                  </p>
                ) : null}
                {!connection && openForm === value ? (
                  <ConnectForm processor={value} onConnected={invalidate} />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
