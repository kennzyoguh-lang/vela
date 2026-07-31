"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, TriangleAlert, Clock } from "lucide-react";
import type { OwnerDailySummary } from "@vela/types";
import { api, ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// Design System 7.1's "first thing shown on login" requirement (Piece 3 of
// the anti-theft feature set) — this renders above the "Home" heading and
// the widget grid, not inside either. A 403 means the signed-in role isn't
// owner/admin (e.g. accountant, view_only) — this banner just isn't for
// them, so it renders nothing rather than an error a non-owner can't act on.
export function OwnerDailyStatusBanner() {
  const { data: summary, error } = useQuery({
    queryKey: ["owner-summary-today"],
    queryFn: () => api.get<OwnerDailySummary>("/v1/owner-summary/today"),
    retry: false,
  });

  if (error instanceof ApiError && error.status === 403) return null;
  if (!summary) return null;

  const salesPhrase = `${summary.salesCount} sale${summary.salesCount === 1 ? "" : "s"} today`;
  const expectedPhrase = `${formatMoney(summary.expectedAmount, "NGN")} expected`;

  if (summary.status === "pending") {
    return (
      <div className="bg-surface-secondary flex items-center gap-3 rounded-2xl px-5 py-4">
        <Clock className="text-text-secondary size-6 shrink-0" aria-hidden />
        <p className="font-ui text-text-primary text-[0.9375rem] font-semibold">
          {salesPhrase}, {expectedPhrase}. No cash count yet today.
        </p>
      </div>
    );
  }

  const countedPhrase = `${formatMoney(summary.countedAmount ?? 0, "NGN")} counted`;
  const isMatched = summary.status === "matched";
  const diffPhrase =
    !isMatched && summary.difference != null
      ? `${formatMoney(Math.abs(summary.difference), "NGN")} ${summary.status === "shortfall" ? "short" : "over"}`
      : null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-5 py-4",
        isMatched ? "bg-sage/15" : "bg-rust/15",
      )}
    >
      {isMatched ? (
        <CheckCircle2 className="text-sage size-6 shrink-0" aria-hidden />
      ) : (
        <TriangleAlert className="text-rust size-6 shrink-0" aria-hidden />
      )}
      <p
        className={cn(
          "font-ui text-[0.9375rem] font-semibold",
          isMatched ? "text-sage" : "text-rust",
        )}
      >
        {salesPhrase}, {expectedPhrase}, {countedPhrase}
        {diffPhrase ? `. ${diffPhrase}.` : ". All matched."}
      </p>
    </div>
  );
}
