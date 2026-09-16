"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import type { Client, Invoice, Quote } from "@vela/types";
import { DetailTemplate } from "@/components/templates/DetailTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { quoteBadgeStatus, quoteStatusLabel, formatValidUntilPhrase } from "@/lib/quote-status";
import { formatMoney } from "@/lib/format";
import { api, ApiError } from "@/lib/api/client";

// Mirrors app/(dashboard)/invoices/[invoiceId]/page.tsx's shape — accept/
// decline only ever happen on the public portal (the client's own action),
// so this dashboard view is Send + (once accepted) Convert to invoice, not
// a status-editing form.
export default function QuoteDetailPage() {
  const params = useParams<{ quoteId: string }>();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quotes", params.quoteId],
    queryFn: () => api.get<Quote>(`/v1/quotes/${params.quoteId}`),
    staleTime: 30_000,
  });

  const { data: client } = useQuery({
    queryKey: ["clients", quote?.clientId],
    queryFn: () => api.get<Client>(`/v1/clients/${quote!.clientId}`),
    enabled: !!quote?.clientId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["quotes", params.quoteId] });
    queryClient.invalidateQueries({ queryKey: ["quotes"] });
  }

  const sendMutation = useMutation({
    mutationFn: () => api.post<Quote>(`/v1/quotes/${params.quoteId}/send`),
    onSuccess: invalidate,
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Couldn't send the quote."),
  });

  const convertMutation = useMutation({
    mutationFn: () => api.post<Invoice>(`/v1/quotes/${params.quoteId}/convert-to-invoice`),
    onSuccess: (invoice) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      window.location.href = `/invoices/${invoice.id}`;
    },
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Couldn't convert to an invoice."),
  });

  if (isLoading || !quote) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const viewUrl =
    typeof window !== "undefined" ? `${window.location.origin}/quote/${quote.portalToken}` : "";
  const canSend = quote.status === "draft";
  const canConvert = quote.status === "accepted" && !quote.convertedInvoiceId;

  const lineItems = quote.lineItems;

  return (
    <DetailTemplate
      header={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-data text-gold mb-2 text-[0.7rem] font-bold uppercase tracking-[0.14em]">
                Quote
              </p>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-text-primary text-[1.75rem] font-normal leading-tight">
                  {quote.number}
                </h1>
                <Badge
                  status={quoteBadgeStatus(quote.status)}
                  label={quoteStatusLabel(quote.status)}
                />
              </div>
              <p className="font-ui text-text-secondary mt-1 text-[0.875rem]">
                {client?.name ?? "…"} · {formatValidUntilPhrase(quote.validUntil, quote.status)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canSend ? (
                <Button
                  size="sm"
                  loading={sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  Send quote
                </Button>
              ) : null}
              {canConvert ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={convertMutation.isPending}
                  onClick={() => convertMutation.mutate()}
                >
                  Convert to invoice
                </Button>
              ) : null}
              {quote.convertedInvoiceId ? (
                <Link href={`/invoices/${quote.convertedInvoiceId}`}>
                  <Button size="sm" variant="secondary">
                    View invoice
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
          {actionError ? <Alert variant="danger" title={actionError} /> : null}
        </div>
      }
      main={
        <Card accent>
          <CardHeader>
            <CardTitle eyebrow>Line items</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-border font-ui text-text-secondary border-b text-left text-[0.75rem] uppercase tracking-[0.02em]">
                  <th className="pb-2 font-semibold">Description</th>
                  <th className="pb-2 text-right font-semibold">Qty</th>
                  <th className="pb-2 text-right font-semibold">Unit price</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => (
                  <tr key={i} className="font-ui text-text-primary text-[0.875rem]">
                    <td className="py-2">{item.description}</td>
                    <td className="font-data py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="font-data py-2 text-right tabular-nums">
                      {formatMoney(item.unitPrice, quote.currency)}
                    </td>
                    <td className="font-data py-2 text-right tabular-nums">
                      {formatMoney(item.quantity * item.unitPrice, quote.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-border mt-3 flex flex-col items-end gap-1 border-t pt-3">
            <p className="font-ui text-text-secondary text-[0.875rem]">
              Subtotal{" "}
              <span className="font-data tabular-nums">
                {formatMoney(quote.subtotal, quote.currency)}
              </span>
            </p>
            <p className="font-ui text-text-secondary text-[0.875rem]">
              Tax{" "}
              <span className="font-data tabular-nums">
                {formatMoney(quote.tax, quote.currency)}
              </span>{" "}
              · Discount{" "}
              <span className="font-data tabular-nums">
                {formatMoney(quote.discount, quote.currency)}
              </span>
            </p>
            <p className="font-data text-text-primary text-[1.125rem] font-bold tabular-nums">
              Total {formatMoney(quote.total, quote.currency)}
            </p>
          </div>
          {quote.notes ? (
            <p className="font-ui text-text-secondary mt-4 text-[0.875rem]">{quote.notes}</p>
          ) : null}
          {quote.status === "declined" && quote.declineReason ? (
            <div className="mt-4">
              <Alert variant="danger" title="Declined">
                {quote.declineReason}
              </Alert>
            </div>
          ) : null}
        </Card>
      }
      rail={
        <div className="flex flex-col gap-4">
          <Card accent>
            <CardHeader>
              <CardTitle eyebrow>Quote link</CardTitle>
            </CardHeader>
            <p className="text-text-secondary break-all font-mono text-[0.75rem]">{viewUrl}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                navigator.clipboard.writeText(viewUrl);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
            >
              <Copy className="size-4" aria-hidden />
              {linkCopied ? "Copied!" : "Copy link"}
            </Button>
          </Card>
          <Card accent>
            <CardHeader>
              <CardTitle eyebrow>Activity</CardTitle>
            </CardHeader>
            <ul className="font-ui text-text-secondary flex flex-col gap-1 text-[0.8125rem]">
              <li>Sent: {quote.sentAt ? new Date(quote.sentAt).toLocaleDateString() : "—"}</li>
              <li>
                Responded:{" "}
                {quote.respondedAt ? new Date(quote.respondedAt).toLocaleDateString() : "—"}
              </li>
            </ul>
          </Card>
        </div>
      }
    />
  );
}
