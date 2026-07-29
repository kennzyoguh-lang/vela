"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import type { PayrollRun } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { api } from "@/lib/api/client";

function currentPeriodLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Mirrors OutstandingInvoicesWidget.tsx / ComplianceWidget.tsx's shape.
export function UpcomingPayrollWidget() {
  const { data: runs, isLoading } = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: () => api.get<PayrollRun[]>("/v1/payroll-runs"),
    staleTime: 30_000,
  });

  const currentRun = runs?.find((r) => r.periodLabel === currentPeriodLabel());

  return (
    <Card className="flex h-full flex-col justify-between gap-4">
      <div>
        <CardHeader>
          <CardTitle>Upcoming payroll</CardTitle>
          <Users className="text-text-secondary size-4" aria-hidden />
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-6 w-2/3" />
        ) : !currentRun ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No payroll run yet for {currentPeriodLabel()}.
          </p>
        ) : (
          <p className="font-ui text-text-primary text-[0.875rem]">
            <span className="text-[1.25rem] font-bold">
              {formatMoney(currentRun.totalNetPay, "NGN")}
            </span>{" "}
            {currentRun.status === "paid" ? "paid" : "pending"} for {currentRun.periodLabel}
          </p>
        )}
      </div>
      <Link href="/people">
        <Button variant="secondary" size="sm">
          View people
        </Button>
      </Link>
    </Card>
  );
}
