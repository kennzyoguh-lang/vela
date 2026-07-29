"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import type { Invoice } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { api } from "@/lib/api/client";

const OUTSTANDING_STATUSES = ["sent", "viewed", "partially_paid", "overdue"];

export function OutstandingInvoicesWidget() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", "all"],
    queryFn: () => api.get<Invoice[]>("/v1/invoices"),
    staleTime: 30_000,
  });

  const outstanding = invoices?.filter((inv) => OUTSTANDING_STATUSES.includes(inv.status)) ?? [];
  const totalOutstanding = outstanding.reduce((sum, inv) => sum + parseFloat(inv.total), 0);
  const currency = outstanding[0]?.currency ?? "NGN";

  return (
    <Card className="flex h-full flex-col justify-between gap-4">
      <div>
        <CardHeader>
          <CardTitle>Outstanding invoices</CardTitle>
          <FileText className="text-text-secondary size-4" aria-hidden />
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-6 w-2/3" />
        ) : outstanding.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Nothing outstanding — clients are all paid up.
          </p>
        ) : (
          <p className="font-ui text-text-primary text-[0.875rem]">
            <span className="text-[1.25rem] font-bold">
              {formatMoney(totalOutstanding, currency)}
            </span>{" "}
            across {outstanding.length} invoice{outstanding.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
      <Link href="/invoices">
        <Button variant="secondary" size="sm">
          View invoices
        </Button>
      </Link>
    </Card>
  );
}
