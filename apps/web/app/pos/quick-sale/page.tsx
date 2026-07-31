"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, CheckCircle2, Copy, MessageSquare } from "lucide-react";
import type { QuickSaleResult } from "@vela/types";
import { api, ApiError } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { NumberPad } from "@/components/pos/NumberPad";
import { ConfirmSaleButton } from "@/components/pos/ConfirmSaleButton";
import { PaymentQrCode } from "@/components/pos/PaymentQrCode";
import { Alert } from "@/components/ui/Alert";
import { formatMoney } from "@/lib/format";

// Quick Sale / Instant Collect Piece 2 — a separate screen from invoice
// creation: amount-only entry, one confirm button, no customer name/line
// items/due date. The collection screen shows a scannable QR (Piece 3), a
// copyable link, and an optional "+ Send SMS" reveal (Piece 4) for a
// customer who isn't standing close enough to scan or be handed the phone.
export default function PosQuickSalePage() {
  const { t } = useTranslation();
  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<QuickSaleResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsSent, setSmsSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<QuickSaleResult>("/v1/quick-sales", {
        amount: Number(digits || "0"),
        currency: "NGN",
      }),
    onSuccess: (sale) => setResult(sale),
  });

  const smsMutation = useMutation({
    mutationFn: () => api.post(`/v1/quick-sales/${result!.id}/send-sms`, { phone: smsPhone }),
    onSuccess: () => setSmsSent(true),
  });

  function reset() {
    setResult(null);
    setDigits("");
    setCopied(false);
    setSmsOpen(false);
    setSmsPhone("");
    setSmsSent(false);
  }

  if (result) {
    const payUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/pay/${result.paymentPortalToken}`
        : "";

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <CheckCircle2 className="text-sage size-16" aria-hidden />
        <p className="font-data text-[2.5rem] font-bold text-white">
          {formatMoney(result.total, result.currency)}
        </p>
        <p className="font-ui text-[1rem] text-white/70">{t("pos.quickSale.linkReady")}</p>

        <PaymentQrCode value={payUrl} label={t("pos.quickSale.title")} />

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(payUrl);
            setCopied(true);
          }}
          className="font-ui bg-surface-secondary text-text-primary mt-2 flex min-h-[64px] items-center gap-2 rounded-2xl px-8 text-[1.0625rem] font-bold active:scale-95"
        >
          <Copy className="size-5" aria-hidden />
          {copied ? t("pos.quickSale.copied") : t("pos.quickSale.copyLink")}
        </button>

        {smsSent ? (
          <p className="font-ui text-sage text-[0.9375rem] font-semibold">
            {t("pos.quickSale.smsSent")}
          </p>
        ) : smsOpen ? (
          <div className="flex w-full max-w-xs flex-col gap-2">
            <input
              type="tel"
              value={smsPhone}
              onChange={(e) => setSmsPhone(e.target.value)}
              placeholder={t("pos.quickSale.phonePlaceholder")}
              className="bg-surface-secondary text-text-primary font-ui min-h-[56px] rounded-2xl px-4 text-[1rem]"
            />
            {smsMutation.isError ? (
              <Alert
                variant="danger"
                title={
                  smsMutation.error instanceof ApiError
                    ? smsMutation.error.message
                    : t("pos.quickSale.smsError")
                }
              />
            ) : null}
            <button
              type="button"
              onClick={() => smsMutation.mutate()}
              disabled={smsPhone.trim() === "" || smsMutation.isPending}
              className="font-ui bg-surface-secondary text-text-primary flex min-h-[56px] items-center justify-center gap-2 rounded-2xl text-[1rem] font-bold disabled:opacity-40"
            >
              <MessageSquare className="size-5" aria-hidden />
              {smsMutation.isPending ? t("pos.quickSale.sending") : t("pos.quickSale.sendSms")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSmsOpen(true)}
            className="font-ui text-text-secondary flex items-center gap-2 text-[0.9375rem] font-semibold"
          >
            <MessageSquare className="size-4" aria-hidden />
            {t("pos.quickSale.sendSms")}
          </button>
        )}

        <button
          type="button"
          onClick={reset}
          className="font-ui bg-gold text-midnight mt-4 flex min-h-[64px] items-center rounded-2xl px-10 text-[1.25rem] font-bold active:scale-95"
        >
          {t("pos.quickSale.newSale")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/pos/sell" aria-label={t("pos.nav.back")} className="text-white/70">
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <h1 className="font-ui text-[1.5rem] font-bold text-white">{t("pos.quickSale.title")}</h1>
      </div>

      {mutation.isError ? (
        <Alert
          variant="danger"
          title={
            mutation.error instanceof ApiError ? mutation.error.message : t("pos.quickSale.error")
          }
        />
      ) : null}

      <p className="font-ui text-text-secondary text-center text-[0.875rem] font-semibold">
        {t("pos.quickSale.amountLabel")}
      </p>

      <NumberPad digits={digits} onChange={setDigits} clearLabel={t("pos.cashCheck.clear")} />

      <ConfirmSaleButton
        label={t("pos.quickSale.collect")}
        loadingLabel={t("pos.quickSale.collecting")}
        loading={mutation.isPending}
        disabled={digits === ""}
        onClick={() => mutation.mutate()}
      />
    </div>
  );
}
