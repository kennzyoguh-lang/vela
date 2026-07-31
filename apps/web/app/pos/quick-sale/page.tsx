"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, CheckCircle2, Copy } from "lucide-react";
import type { QuickSaleResult } from "@vela/types";
import { api, ApiError } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { NumberPad } from "@/components/pos/NumberPad";
import { ConfirmSaleButton } from "@/components/pos/ConfirmSaleButton";
import { Alert } from "@/components/ui/Alert";
import { formatMoney } from "@/lib/format";

// Quick Sale / Instant Collect Piece 2 — a separate screen from invoice
// creation: amount-only entry, one confirm button, no customer name/line
// items/due date. The collection screen below is deliberately minimal — it
// shows the raw payment link so a trader isn't left with a dead end today,
// but QR (Piece 3) and SMS (Piece 4) are what actually make this fast, and
// will extend this same screen rather than replace it.
export default function PosQuickSalePage() {
  const { t } = useTranslation();
  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<QuickSaleResult | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<QuickSaleResult>("/v1/quick-sales", {
        amount: Number(digits || "0"),
        currency: "NGN",
      }),
    onSuccess: (sale) => setResult(sale),
  });

  function reset() {
    setResult(null);
    setDigits("");
    setCopied(false);
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
