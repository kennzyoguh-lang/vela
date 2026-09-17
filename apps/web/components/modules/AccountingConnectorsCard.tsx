"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountingConnectionSummary, AccountingProvider } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api/client";

const PROVIDERS: { value: AccountingProvider; label: string }[] = [
  { value: "quickbooks", label: "QuickBooks" },
  { value: "xero", label: "Xero" },
  { value: "wave", label: "Wave" },
];

interface ProviderAvailability {
  provider: AccountingProvider;
  configured: boolean;
}

// F-connectors — a business that already keeps its books in QuickBooks/Xero
// shouldn't have to abandon it to use Vela. Every push is one-way
// (Vela -> provider), so the connected app is never a second place Vela
// itself reads from — see accounting-connection.service.ts's own comment.
// Connecting is a full-page OAuth redirect (not an in-app form, unlike
// PaymentConnectorsCard's secret-key paste), so this component's only job
// once "Connect" is clicked is to navigate the browser to the URL the API
// hands back.
export function AccountingConnectorsCard() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const callbackStatus = searchParams.get("accounting");
  const callbackProvider = searchParams.get("provider");
  const [connectError, setConnectError] = useState<string | null>(null);

  const { data: connections, isLoading } = useQuery({
    queryKey: ["accounting-connections"],
    queryFn: () => api.get<AccountingConnectionSummary[]>("/v1/accounting-connections"),
    staleTime: 30_000,
  });

  const { data: availability } = useQuery({
    queryKey: ["accounting-connection-providers"],
    queryFn: () => api.get<ProviderAvailability[]>("/v1/accounting-connections/providers"),
    staleTime: 5 * 60_000,
  });

  const connectMutation = useMutation({
    mutationFn: (provider: AccountingProvider) =>
      api.post<{ url: string }>(`/v1/accounting-connections/${provider}/authorize-url`, {}),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => setConnectError(err instanceof ApiError ? err.message : "Couldn't connect."),
  });

  const disconnectMutation = useMutation({
    mutationFn: (provider: AccountingProvider) =>
      api.delete(`/v1/accounting-connections/${provider}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounting-connections"] }),
  });

  const connectionByProvider = new Map(
    (connections ?? []).filter((c) => c.isActive).map((c) => [c.provider, c]),
  );
  const configuredByProvider = new Map((availability ?? []).map((a) => [a.provider, a.configured]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounting apps</CardTitle>
      </CardHeader>
      <p className="font-ui text-text-secondary text-[0.875rem]">
        Already keep your books in QuickBooks, Xero, or Wave? Connect it and Vela pushes your sent
        and paid invoices there automatically — Vela never reads anything back, so your existing
        books stay exactly as you manage them today.
      </p>

      {callbackStatus === "connected" ? (
        <Alert variant="info" title={`${callbackProvider ?? "Accounting app"} connected`}>
          New invoices will start syncing on the next daily run.
        </Alert>
      ) : null}
      {callbackStatus === "error" ? (
        <Alert variant="danger" title="Connection failed">
          We couldn&apos;t finish connecting {callbackProvider ?? "that app"}. Please try again.
        </Alert>
      ) : null}
      {connectError ? <Alert variant="danger" title={connectError} /> : null}

      {isLoading ? (
        <Skeleton className="mt-3 h-12 w-full" />
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {PROVIDERS.map(({ value, label }) => {
            const connection = connectionByProvider.get(value);
            const configured = configuredByProvider.get(value) ?? false;
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
                    {!configured ? <Badge status="archived" label="Coming soon" /> : null}
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
                      disabled={!configured}
                      loading={connectMutation.isPending}
                      onClick={() => {
                        setConnectError(null);
                        connectMutation.mutate(value);
                      }}
                    >
                      Connect
                    </Button>
                  )}
                </div>
                {!configured ? (
                  <p className="font-ui text-text-secondary mt-1 text-[0.75rem]">
                    {value === "wave"
                      ? "Wave no longer offers a third-party integration API, so this isn't connectable."
                      : `${label} isn't set up on Vela's side yet — check back soon.`}
                  </p>
                ) : null}
                {connection?.lastSyncError ? (
                  <p className="font-ui text-rust mt-1 text-[0.75rem]">
                    Last sync failed: {connection.lastSyncError}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
