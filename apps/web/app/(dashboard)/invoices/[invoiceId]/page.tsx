"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download } from "lucide-react";
import type { Client, Invoice } from "@vela/types";
import { DetailTemplate } from "@/components/templates/DetailTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { invoiceBadgeStatus, invoiceStatusLabel, riskLabel } from "@/lib/invoice-status";
import { formatMoney, formatDuePhrase } from "@/lib/format";
import { api, ApiError, openAuthenticatedPdf } from "@/lib/api/client";

export default function InvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [pdfPending, setPdfPending] = useState(false);

  async function handleDownloadPdf() {
    setActionError(null);
    setPdfPending(true);
    try {
      await openAuthenticatedPdf(`/v1/invoices/${params.invoiceId}/pdf`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't open the invoice PDF.");
    } finally {
      setPdfPending(false);
    }
  }

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoices", params.invoiceId],
    queryFn: () => api.get<Invoice>(`/v1/invoices/${params.invoiceId}`),
    staleTime: 30_000,
  });

  const { data: client } = useQuery({
    queryKey: ["clients", invoice?.clientId],
    queryFn: () => api.get<Client>(`/v1/clients/${invoice!.clientId}`),
    enabled: !!invoice?.clientId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["invoices", params.invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }

  const sendMutation = useMutation({
    mutationFn: () => api.post<Invoice>(`/v1/invoices/${params.invoiceId}/send`),
    onSuccess: invalidate,
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Couldn't send the invoice."),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => api.post<Invoice>(`/v1/invoices/${params.invoiceId}/mark-paid`),
    onSuccess: invalidate,
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Couldn't mark as paid."),
  });

  const voidMutation = useMutation({
    mutationFn: (reason: string) =>
      api.post<Invoice>(`/v1/invoices/${params.invoiceId}/void`, { reason }),
    onSuccess: () => {
      setVoiding(false);
      setVoidReason("");
      invalidate();
    },
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Couldn't void the invoice."),
  });

  if (isLoading || !invoice) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const risk = riskLabel(invoice.riskScore);
  const payUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/pay/${invoice.paymentPortalToken}`
      : "";
  const canSend = invoice.status === "draft";
  const canMarkPaid = ["sent", "viewed", "partially_paid", "overdue"].includes(invoice.status);
  const canVoid = !["paid", "void", "written_off"].includes(invoice.status);

  const lineItems = invoice.lineItems;

  return (
    <DetailTemplate
      header={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-ui text-text-primary text-[1.5rem] font-bold">
                  {invoice.number}
                </h1>
                <Badge
                  status={invoiceBadgeStatus(invoice.status)}
                  label={invoiceStatusLabel(invoice.status)}
                />
              </div>
              <p className="font-ui text-text-secondary text-[0.875rem]">
                {invoice.source === "quick_sale"
                  ? "Quick Sale — Walk-in customer"
                  : (client?.name ?? "…")}{" "}
                · {formatDuePhrase(invoice.dueDate, invoice.status)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={pdfPending}
                onClick={handleDownloadPdf}
              >
                <Download className="size-4" aria-hidden />
                PDF
              </Button>
              {canSend ? (
                <Button
                  size="sm"
                  loading={sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  Send invoice
                </Button>
              ) : null}
              {canMarkPaid ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={markPaidMutation.isPending}
                  onClick={() => markPaidMutation.mutate()}
                >
                  Mark paid
                </Button>
              ) : null}
              {canVoid ? (
                <Button size="sm" variant="destructive" onClick={() => setVoiding(true)}>
                  Void
                </Button>
              ) : null}
            </div>
          </div>
          {actionError ? <Alert variant="danger" title={actionError} /> : null}
          {voiding ? (
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Reason for voiding"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setVoiding(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!voidReason.trim()}
                  loading={voidMutation.isPending}
                  onClick={() => voidMutation.mutate(voidReason.trim())}
                >
                  Confirm void
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      }
      main={
        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <table className="w-full">
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
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">
                    {formatMoney(item.unitPrice, invoice.currency)}
                  </td>
                  <td className="py-2 text-right">
                    {formatMoney(item.quantity * item.unitPrice, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-border mt-3 flex flex-col items-end gap-1 border-t pt-3">
            <p className="font-ui text-text-secondary text-[0.875rem]">
              Subtotal {formatMoney(invoice.subtotal, invoice.currency)}
            </p>
            <p className="font-ui text-text-secondary text-[0.875rem]">
              Tax {formatMoney(invoice.tax, invoice.currency)} · Discount{" "}
              {formatMoney(invoice.discount, invoice.currency)}
            </p>
            <p className="font-ui text-text-primary text-[1.125rem] font-bold">
              Total {formatMoney(invoice.total, invoice.currency)}
            </p>
          </div>
          {invoice.notes ? (
            <p className="font-ui text-text-secondary mt-4 text-[0.875rem]">{invoice.notes}</p>
          ) : null}
        </Card>
      }
      rail={
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk</CardTitle>
            </CardHeader>
            <p className={`font-ui text-[0.875rem] font-semibold ${risk.className}`}>
              {risk.label}
            </p>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pay Now link</CardTitle>
            </CardHeader>
            <p className="text-text-secondary break-all font-mono text-[0.75rem]">{payUrl}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                navigator.clipboard.writeText(payUrl);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
            >
              <Copy className="size-4" aria-hidden />
              {linkCopied ? "Copied!" : "Copy link"}
            </Button>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <ul className="font-ui text-text-secondary flex flex-col gap-1 text-[0.8125rem]">
              <li>Sent: {invoice.sentAt ? new Date(invoice.sentAt).toLocaleDateString() : "—"}</li>
              <li>
                Viewed: {invoice.viewedAt ? new Date(invoice.viewedAt).toLocaleDateString() : "—"}
              </li>
              <li>Paid: {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "—"}</li>
            </ul>
          </Card>
        </div>
      }
    />
  );
}
