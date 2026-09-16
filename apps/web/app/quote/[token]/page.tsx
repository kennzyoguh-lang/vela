"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import type { PublicQuoteView } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { api, ApiError } from "@/lib/api/client";

// Mirrors app/pay/[token]/page.tsx's shape — standalone public page, no
// login, reached via the quote's own portal_token. Unlike the payment
// portal (a single "pay now" action), this collects an accept/decline
// response instead.
export default function QuotePortalPage() {
  const params = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [respondError, setRespondError] = useState<string | null>(null);

  const {
    data: quote,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["quote-portal", params.token],
    queryFn: () => api.get<PublicQuoteView>(`/v1/quote-portal/${params.token}`),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["quote-portal", params.token] });
  }

  const acceptMutation = useMutation({
    mutationFn: () => api.post(`/v1/quote-portal/${params.token}/accept`),
    onSuccess: invalidate,
    onError: (err) =>
      setRespondError(err instanceof ApiError ? err.message : "Couldn't accept the quote."),
  });

  const declineMutation = useMutation({
    mutationFn: () =>
      api.post(`/v1/quote-portal/${params.token}/decline`, {
        reason: declineReason.trim() || undefined,
      }),
    onSuccess: () => {
      setDeclining(false);
      invalidate();
    },
    onError: (err) =>
      setRespondError(err instanceof ApiError ? err.message : "Couldn't decline the quote."),
  });

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </>
    );
  }

  if (error || !quote) {
    return (
      <Alert variant="danger" title="Quote not found">
        This quote link may have expired.
      </Alert>
    );
  }

  return (
    <>
      <p className="font-ui text-text-secondary text-center text-[0.875rem] font-semibold uppercase tracking-[0.04em]">
        {quote.businessName ?? "VELA"}
      </p>

      <Card className="flex flex-col gap-4">
        <CardHeader>
          <CardTitle>Quote {quote.number}</CardTitle>
        </CardHeader>

        {quote.status === "accepted" ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="text-sage size-10" aria-hidden />
            <p className="font-ui text-text-primary text-[1.125rem] font-semibold">
              Quote accepted
            </p>
            <p className="font-ui text-text-secondary text-[0.875rem]">
              You accepted this quote for {formatMoney(quote.total, quote.currency)}.
            </p>
          </div>
        ) : quote.status === "declined" ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <XCircle className="text-text-secondary size-10" aria-hidden />
            <p className="font-ui text-text-primary text-[1.125rem] font-semibold">
              Quote declined
            </p>
          </div>
        ) : quote.status === "expired" ? (
          <Alert variant="warning" title="This quote has expired">
            Contact the business for an updated quote.
          </Alert>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {quote.lineItems.map((item, i) => (
                <li
                  key={i}
                  className="font-ui text-text-primary flex justify-between text-[0.875rem]"
                >
                  <span>{item.description}</span>
                  <span>{formatMoney(item.quantity * item.unitPrice, quote.currency)}</span>
                </li>
              ))}
            </ul>
            <div className="border-border flex items-center justify-between border-t pt-3">
              <span className="font-ui text-text-secondary text-[0.875rem]">Total</span>
              <span className="font-ui text-text-primary text-[1.25rem] font-bold">
                {formatMoney(quote.total, quote.currency)}
              </span>
            </div>
            <p className="font-ui text-text-secondary text-[0.75rem]">
              Valid until {new Date(quote.validUntil).toLocaleDateString()}
            </p>

            {respondError ? <Alert variant="danger" title={respondError} /> : null}

            {declining ? (
              <div className="flex flex-col gap-3">
                <Input
                  label="Reason (optional)"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setDeclining(false)}
                  >
                    Back
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    loading={declineMutation.isPending}
                    onClick={() => declineMutation.mutate()}
                  >
                    Confirm decline
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setDeclining(true)}>
                  Decline
                </Button>
                <Button
                  className="flex-1"
                  loading={acceptMutation.isPending}
                  onClick={() => acceptMutation.mutate()}
                >
                  Accept quote
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
