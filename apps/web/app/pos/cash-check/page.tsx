"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CashReconciliation } from "@vela/types";
import { ChevronLeft, CheckCircle2, TriangleAlert, CloudOff } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { NumberPad } from "@/components/pos/NumberPad";
import { ConfirmSaleButton } from "@/components/pos/ConfirmSaleButton";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";

interface TodayExpected {
  expectedAmount: number;
  businessDate: string;
  checked: boolean;
}

// Short celebratory beep on a match — Web Audio, feature-detected and
// silently skipped on any error (same degrade-quietly stance as
// VoiceInputButton's speech recognition; a missing beep must never block
// the result screen from showing).
function playMatchBeep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // No audio available — the visual result still shows, so this is fine to skip.
  }
}

export default function PosCashCheckPage() {
  const { t } = useTranslation();
  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<CashReconciliation | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const enqueue = useOfflineQueueStore((s) => s.enqueue);

  const { data: today, isLoading } = useQuery({
    queryKey: ["cash-check-today"],
    queryFn: () => api.get<TodayExpected>("/v1/cash-checks/today"),
  });

  const mutation = useMutation({
    mutationFn: (input: { countedAmount: number }) =>
      api.post<CashReconciliation>("/v1/cash-checks", input),
    onSuccess: (record) => {
      setResult(record);
      if (record.matched) playMatchBeep();
    },
    onError: (err, input) => {
      // A real ApiError is the caller's own mistake — surface it via the
      // Alert below. Anything else means this never reached the server, so
      // there's no way to know match/mismatch yet — that's exactly why the
      // saved-offline state below never claims a checkmark or a difference
      // it doesn't actually have.
      if (err instanceof ApiError) return;
      enqueue("/v1/cash-checks", input);
      setSavedOffline(true);
    },
  });

  const currency = "NGN";

  if (result || savedOffline) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        {savedOffline ? (
          <>
            <CloudOff className="text-cobalt size-24" aria-hidden />
            <p className="font-ui text-[1.75rem] font-bold text-white">
              {t("pos.cashCheck.savedOffline")}
            </p>
          </>
        ) : result?.matched ? (
          <>
            <CheckCircle2 className="text-sage size-24" aria-hidden />
            <p className="font-ui text-[1.75rem] font-bold text-white">
              {t("pos.cashCheck.matchTitle")}
            </p>
          </>
        ) : (
          <>
            <TriangleAlert className="text-rust size-24" aria-hidden />
            <p className="font-ui text-[1.75rem] font-bold text-white">
              {t("pos.cashCheck.mismatchTitle")}
            </p>
            <p className="font-data text-rust text-[2rem] font-bold">
              {formatMoney(Math.abs(Number(result?.difference)), result?.currency ?? currency)}
            </p>
            <p className="font-ui text-[0.9375rem] text-white/70">
              {t("pos.cashCheck.difference")}
            </p>
          </>
        )}
        <Link
          href="/pos/sell"
          className="font-ui bg-gold text-midnight mt-4 flex min-h-[64px] items-center rounded-2xl px-10 text-[1.25rem] font-bold active:scale-95"
        >
          {t("pos.cashCheck.done")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/pos/sell" aria-label={t("pos.nav.back")} className="text-white/70">
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <h1 className="font-ui text-[1.5rem] font-bold text-white">{t("pos.cashCheck.title")}</h1>
      </div>

      {mutation.isError ? (
        <Alert
          variant="danger"
          title={
            mutation.error instanceof ApiError ? mutation.error.message : t("pos.cashCheck.error")
          }
        />
      ) : null}

      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-2xl" />
      ) : (
        <div className="bg-surface-secondary/50 rounded-2xl px-4 py-5 text-center">
          <p className="font-ui text-text-secondary text-[0.9375rem] font-semibold">
            {t("pos.cashCheck.expected")}
          </p>
          <p className="font-data text-text-primary text-[2rem] font-bold">
            {formatMoney(today?.expectedAmount ?? "0", currency)}
          </p>
        </div>
      )}

      <p className="font-ui text-text-secondary text-center text-[0.875rem] font-semibold">
        {t("pos.cashCheck.countLabel")}
      </p>

      <NumberPad
        digits={digits}
        onChange={setDigits}
        currency={currency}
        clearLabel={t("pos.cashCheck.clear")}
      />

      <ConfirmSaleButton
        label={t("pos.cashCheck.submit")}
        loadingLabel={t("pos.cashCheck.submitting")}
        loading={mutation.isPending}
        disabled={digits === ""}
        onClick={() => mutation.mutate({ countedAmount: Number(digits || "0") })}
      />
    </div>
  );
}
