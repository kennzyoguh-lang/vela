"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { api } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface TodayExpected {
  expectedAmount: number;
  businessDate: string;
  checked: boolean;
}

// The cash check itself is opt-in (Piece 2) — nothing stops a trader from
// simply never running it, which quietly defeats the anti-theft loop's
// whole point. This is a non-blocking reminder, not a hard gate: forcing
// every sale to wait on cash-check completion would tie two otherwise
// independent flows together and risk blocking real sales over an
// unrelated step. Shares the same react-query cache key as
// /pos/cash-check's own fetch, so there's no extra request cost from
// having both mounted.
export function CashCheckNudgeBanner() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["cash-check-today"],
    queryFn: () => api.get<TodayExpected>("/v1/cash-checks/today"),
    staleTime: 30_000,
  });

  if (!data || data.checked || data.expectedAmount <= 0) return null;

  return (
    <Link
      href="/pos/cash-check"
      className="bg-gold/15 border-gold/40 font-ui flex items-center gap-2 rounded-2xl border px-4 py-3 text-[0.875rem] font-semibold text-white"
    >
      <TriangleAlert className="text-gold size-5 shrink-0" aria-hidden />
      {t("pos.sell.cashCheckReminder")}
    </Link>
  );
}
