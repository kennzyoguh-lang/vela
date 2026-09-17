"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StaffLeaderboardEntry } from "@vela/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Period = "this_month" | "last_month";

function periodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = period === "this_month" ? now.getMonth() : now.getMonth() - 1;
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

// Anti-theft accountability — sales volume and cash-handling accuracy side
// by side, deliberately never blended into one score
// (staff-leaderboard.service.ts's own comment explains why). A top seller
// whose count is frequently short reads very differently here than a top
// seller whose count always matches — a single ranking number would hide
// exactly that distinction.
export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("this_month");
  const { from, to } = periodRange(period);

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["staff-leaderboard", from, to],
    queryFn: () => api.get<StaffLeaderboardEntry[]>(`/v1/staff-leaderboard?from=${from}&to=${to}`),
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="People" title="Staff leaderboard" />

      <div
        className="bg-surface-secondary rounded-pill inline-flex gap-1 self-start p-1"
        role="group"
        aria-label="Reporting period"
      >
        {(["this_month", "last_month"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={cn(
              "font-ui rounded-pill duration-quick h-11 px-4 text-[0.8125rem] font-semibold transition-colors",
              period === p
                ? "bg-surface-overlay text-text-primary shadow-1"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {p === "this_month" ? "This month" : "Last month"}
          </button>
        ))}
      </div>

      <Card accent>
        <CardHeader>
          <CardTitle eyebrow>Sales &amp; cash accuracy</CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !leaderboard || leaderboard.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No sales or cash checks recorded for this period yet.
          </p>
        ) : (
          <div className="divide-border flex flex-col divide-y">
            {leaderboard.map((entry, index) => {
              const accuracyRate =
                entry.cashChecksCount > 0
                  ? Math.round((entry.matchedCashChecksCount / entry.cashChecksCount) * 100)
                  : null;
              return (
                <div
                  key={entry.staffUserId}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-data text-text-secondary w-6 shrink-0 text-[0.875rem] tabular-nums">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-ui text-text-primary text-[0.875rem] font-semibold">
                        {entry.staffName}
                      </p>
                      <p className="font-data text-text-secondary text-[0.75rem] tabular-nums">
                        {entry.salesCount} sale{entry.salesCount === 1 ? "" : "s"} ·{" "}
                        {formatMoney(entry.salesTotal, "NGN")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    {accuracyRate === null ? (
                      <Badge status="draft" label="No cash checks" />
                    ) : (
                      <Badge
                        status={
                          accuracyRate === 100
                            ? "active"
                            : accuracyRate >= 80
                              ? "partial"
                              : "overdue"
                        }
                        label={`${accuracyRate}% cash accuracy`}
                      />
                    )}
                    {entry.totalShortfall > 0 ? (
                      <span className="font-data text-rust text-[0.75rem] tabular-nums">
                        -{formatMoney(entry.totalShortfall, "NGN")} short
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
