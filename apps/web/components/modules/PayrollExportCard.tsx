"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PayrollExportConfigSummary } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api/client";

// F-connectors — a generic connection for a third-party payroll app, for a
// business that doesn't want to use Vela's own payroll. Unlike
// PaymentConnectorsCard/AccountingConnectorsCard, there's no specific
// provider to authenticate into (see payroll-export.service.ts's own
// comment) — Vela sends a signed webhook to a URL the org supplies, the
// same shape Shopify/GitHub use for their own outbound webhooks. The
// signing secret is shown exactly once, right after it's generated, same
// UX as an API key.
export function PayrollExportCard() {
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ["payroll-export-config"],
    queryFn: () => api.get<PayrollExportConfigSummary | null>("/v1/payroll-export-config"),
    staleTime: 30_000,
  });

  const configureMutation = useMutation({
    mutationFn: () =>
      api.post<{ webhookUrl: string; secret: string }>("/v1/payroll-export-config", {
        webhookUrl,
      }),
    onSuccess: ({ secret }) => {
      setRevealedSecret(secret);
      setWebhookUrl("");
      queryClient.invalidateQueries({ queryKey: ["payroll-export-config"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't save that URL."),
  });

  const regenerateMutation = useMutation({
    mutationFn: () =>
      api.post<{ secret: string }>("/v1/payroll-export-config/regenerate-secret", {}),
    onSuccess: ({ secret }) => setRevealedSecret(secret),
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't regenerate the secret."),
  });

  const disableMutation = useMutation({
    mutationFn: () => api.delete("/v1/payroll-export-config"),
    onSuccess: () => {
      setRevealedSecret(null);
      queryClient.invalidateQueries({ queryKey: ["payroll-export-config"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll</CardTitle>
      </CardHeader>
      <p className="font-ui text-text-secondary text-[0.875rem]">
        Using a different payroll provider? Give Vela a webhook URL and every payroll run gets
        pushed there automatically once marked paid, signed so your system can verify it really came
        from Vela.
      </p>

      {error ? <Alert variant="danger" title={error} /> : null}
      {revealedSecret ? (
        <Alert variant="warning" title="Signing secret — shown only this once">
          <code className="bg-surface-raised mt-1 block break-all rounded px-2 py-1 text-[0.75rem]">
            {revealedSecret}
          </code>
          Copy it now and store it with your receiving system — Vela can&apos;t show it again.
        </Alert>
      ) : null}

      {isLoading ? (
        <Skeleton className="mt-3 h-12 w-full" />
      ) : config ? (
        <div className="border-border mt-3 flex flex-col gap-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <p className="font-ui text-text-primary truncate text-[0.875rem] font-semibold">
                {config.webhookUrl}
              </p>
              {config.isActive ? (
                <Badge status="active" label="Active" />
              ) : (
                <Badge status="archived" label="Disabled" />
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              loading={disableMutation.isPending}
              onClick={() => disableMutation.mutate()}
            >
              Disconnect
            </Button>
          </div>
          {config.lastDeliveryError ? (
            <p className="font-ui text-rust text-[0.75rem]">
              Last delivery failed: {config.lastDeliveryError}
            </p>
          ) : config.lastDeliveryAt ? (
            <p className="font-ui text-text-secondary text-[0.75rem]">
              Last delivered {new Date(config.lastDeliveryAt).toLocaleString()}
            </p>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            loading={regenerateMutation.isPending}
            onClick={() => {
              setError(null);
              regenerateMutation.mutate();
            }}
          >
            Regenerate signing secret
          </Button>
        </div>
      ) : (
        <form
          className="border-border mt-3 flex flex-col gap-3 rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            configureMutation.mutate();
          }}
        >
          <Input
            label="Webhook URL"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-payroll-app.example.com/webhooks/vela"
            helperText="Must be https — Vela POSTs a JSON payload here every time a payroll run is marked paid"
            required
          />
          <Button
            type="submit"
            size="sm"
            className="self-start"
            loading={configureMutation.isPending}
            disabled={!webhookUrl.trim()}
          >
            Connect
          </Button>
        </form>
      )}
    </Card>
  );
}
