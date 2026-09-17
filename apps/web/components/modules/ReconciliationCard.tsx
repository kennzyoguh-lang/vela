"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReconciliationSuggestion } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { api, ApiError } from "@/lib/api/client";

// Bank reconciliation — a business paid by direct bank transfer (extremely
// common in Nigeria for B2B invoices) otherwise has no way to know its
// bank feed and its invoice records agree without manually cross-checking
// both by hand. Suggestions only ever come from unmatched CREDIT
// transactions against the org's own unpaid invoices
// (reconciliation.service.ts); confirming one marks that invoice paid.
export function ReconciliationCard({ currency }: { currency: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["reconciliation-suggestions"],
    queryFn: () =>
      api.get<ReconciliationSuggestion[]>("/v1/bank-transactions/reconciliation/suggestions"),
    staleTime: 30_000,
  });

  const confirmMutation = useMutation({
    mutationFn: ({ transactionId, invoiceId }: { transactionId: string; invoiceId: string }) =>
      api.post(`/v1/bank-transactions/${transactionId}/reconciliation`, { invoiceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't confirm that match."),
  });

  if (isLoading) {
    return (
      <Card accent>
        <CardHeader>
          <CardTitle eyebrow>Reconciliation</CardTitle>
        </CardHeader>
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <Card accent>
      <CardHeader>
        <CardTitle eyebrow>Reconciliation</CardTitle>
      </CardHeader>
      <p className="font-ui text-text-secondary text-[0.875rem]">
        These incoming transfers look like they settled one of your unpaid invoices. Confirm a match
        to mark that invoice paid.
      </p>
      {error ? <Alert variant="danger" title={error} /> : null}
      <div className="divide-border mt-3 flex flex-col divide-y">
        {suggestions.map((suggestion) => (
          <div key={suggestion.transactionId} className="flex flex-col gap-2 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-ui text-text-primary truncate text-[0.875rem] font-semibold">
                  {suggestion.narration}
                </p>
                <p className="font-data text-text-secondary text-[0.75rem] tabular-nums">
                  {new Date(suggestion.transactionDate).toLocaleDateString()}
                </p>
              </div>
              <p className="font-data text-sage shrink-0 text-[0.875rem] font-bold tabular-nums">
                +{formatMoney(suggestion.amount, currency)}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:pl-4">
              {suggestion.candidates.map((candidate) => {
                const pending =
                  confirmMutation.isPending &&
                  confirmMutation.variables?.transactionId === suggestion.transactionId &&
                  confirmMutation.variables?.invoiceId === candidate.invoiceId;
                return (
                  <div
                    key={candidate.invoiceId}
                    className="border-border flex items-center justify-between gap-3 rounded-md border p-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Link
                        href={`/invoices/${candidate.invoiceId}`}
                        className="font-ui text-text-primary truncate text-[0.8125rem] font-semibold hover:underline"
                      >
                        {candidate.invoiceNumber}
                      </Link>
                      <Badge
                        status={candidate.confidence === "exact" ? "active" : "partial"}
                        label={candidate.confidence === "exact" ? "Exact amount" : "Close amount"}
                      />
                      <span className="font-data text-text-secondary text-[0.75rem] tabular-nums">
                        {formatMoney(candidate.total, currency)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={pending}
                      onClick={() => {
                        setError(null);
                        confirmMutation.mutate({
                          transactionId: suggestion.transactionId,
                          invoiceId: candidate.invoiceId,
                        });
                      }}
                    >
                      Confirm match
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
