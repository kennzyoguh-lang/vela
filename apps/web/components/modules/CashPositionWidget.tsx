"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import type { BankAccount } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { api } from "@/lib/api/client";

// Mirrors OutstandingInvoicesWidget.tsx / ComplianceWidget.tsx's shape.
export function CashPositionWidget() {
  const {
    data: accounts,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<BankAccount[]>("/v1/bank-accounts"),
    staleTime: 60_000,
  });

  const total = (accounts ?? []).reduce((sum, acc) => sum + parseFloat(acc.currentBalance), 0);
  const currency = accounts?.[0]?.currency ?? "NGN";

  return (
    <Card className="flex h-full flex-col justify-between gap-4">
      <div>
        <CardHeader>
          <CardTitle>Cash position</CardTitle>
          <Landmark className="text-text-secondary size-4" aria-hidden />
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-6 w-2/3" />
        ) : error ? (
          <p className="font-ui text-status-danger text-[0.875rem]">
            Couldn&apos;t load — try again shortly.
          </p>
        ) : !accounts || accounts.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Connect a bank account to see your balance here.
          </p>
        ) : (
          <p className="font-ui text-text-primary text-[1.25rem] font-bold">
            {formatMoney(total, currency)}
          </p>
        )}
      </div>
      <Link href="/money">
        <Button variant="secondary" size="sm">
          View money
        </Button>
      </Link>
    </Card>
  );
}
