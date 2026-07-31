"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import type { PublicInvoiceView } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { api, ApiError } from "@/lib/api/client";

export default function PayInvoicePage() {
  const params = useParams<{ token: string }>();
  const [payerEmail, setPayerEmail] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  const {
    data: invoice,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["pay", params.token],
    queryFn: () => api.get<PublicInvoiceView>(`/v1/pay/${params.token}`),
  });

  const payMutation = useMutation({
    mutationFn: () =>
      api.post<{ checkoutUrl?: string; alreadyPaid?: boolean }>(`/v1/pay/${params.token}/pay`, {
        payerEmail,
      }),
    onSuccess: (result) => {
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
    },
    onError: (err) =>
      setPayError(err instanceof ApiError ? err.message : "Couldn't start the payment. Try again."),
  });

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </>
    );
  }

  if (error || !invoice) {
    return (
      <Alert variant="danger" title="Invoice not found">
        This payment link may have expired.
      </Alert>
    );
  }

  const isPaid = invoice.status === "paid";

  return (
    <>
      <p className="font-ui text-text-secondary text-center text-[0.875rem] font-semibold uppercase tracking-[0.04em]">
        {invoice.businessName ?? "VELA"}
      </p>

      <Card className="flex flex-col gap-4">
        <CardHeader>
          <CardTitle>
            {invoice.isQuickSale ? "Payment Request" : `Invoice ${invoice.number}`}
          </CardTitle>
        </CardHeader>

        {isPaid ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="text-sage size-10" aria-hidden />
            <p className="font-ui text-text-primary text-[1.125rem] font-semibold">
              Payment received
            </p>
            <p className="font-ui text-text-secondary text-[0.875rem]">
              {formatMoney(invoice.total, invoice.currency)}{" "}
              {invoice.isQuickSale
                ? "was paid. Thank you."
                : "was paid on this invoice. Thank you."}
            </p>
          </div>
        ) : (
          <>
            {!invoice.isQuickSale ? (
              <ul className="flex flex-col gap-2">
                {invoice.lineItems.map((item, i) => (
                  <li
                    key={i}
                    className="font-ui text-text-primary flex justify-between text-[0.875rem]"
                  >
                    <span>{item.description}</span>
                    <span>{formatMoney(item.quantity * item.unitPrice, invoice.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="border-border flex items-center justify-between border-t pt-3">
              <span className="font-ui text-text-secondary text-[0.875rem]">
                {invoice.isQuickSale ? "Amount" : "Total due"}
              </span>
              <span className="font-ui text-text-primary text-[1.25rem] font-bold">
                {formatMoney(invoice.total, invoice.currency)}
              </span>
            </div>
            {!invoice.isQuickSale ? (
              <p className="font-ui text-text-secondary text-[0.75rem]">
                Due {new Date(invoice.dueDate).toLocaleDateString()}
              </p>
            ) : null}

            {payError ? <Alert variant="danger" title={payError} /> : null}

            <Input
              label="Your email"
              type="email"
              helperText="For your payment receipt"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
              required
            />
            <Button
              className="w-full"
              disabled={!payerEmail.trim()}
              loading={payMutation.isPending}
              onClick={() => payMutation.mutate()}
            >
              Pay now
            </Button>
          </>
        )}
      </Card>
    </>
  );
}
