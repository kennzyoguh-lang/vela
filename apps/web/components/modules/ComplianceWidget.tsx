"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import type { ComplianceFiling, ComplianceObligation } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatFilingDuePhrase } from "@/lib/compliance-status";
import { api } from "@/lib/api/client";

// Mirrors OutstandingInvoicesWidget.tsx's shape — shows the nearest unfiled
// due date rather than a count, since "what's next" is the question this
// widget answers (Design System 6.5).
export function ComplianceWidget() {
  const {
    data: filings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["compliance", "filings"],
    queryFn: () => api.get<ComplianceFiling[]>("/v1/compliance/filings"),
    staleTime: 30_000,
  });

  const { data: obligations } = useQuery({
    queryKey: ["compliance", "obligations"],
    queryFn: () => api.get<ComplianceObligation[]>("/v1/compliance/obligations"),
    staleTime: 5 * 60_000,
  });

  const unfiled = (filings ?? [])
    .filter((f) => f.status !== "filed")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const next = unfiled[0];
  const nextObligation = next
    ? obligations?.find((o) => o.type === next.obligationType)
    : undefined;

  return (
    <Card className="flex h-full flex-col justify-between gap-4">
      <div>
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
          <ShieldCheck className="text-text-secondary size-4" aria-hidden />
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-6 w-2/3" />
        ) : error ? (
          <p className="font-ui text-status-danger text-[0.875rem]">
            Couldn&apos;t load — try again shortly.
          </p>
        ) : !next ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Nothing due — you're all caught up.
          </p>
        ) : (
          <p className="font-ui text-text-primary text-[0.875rem]">
            <span className="text-[1rem] font-bold">
              {nextObligation?.label ?? next.obligationType}
            </span>
            <br />
            {formatFilingDuePhrase(next.dueDate, next.status)}
          </p>
        )}
      </div>
      <Link href="/compliance">
        <Button variant="secondary" size="sm">
          View compliance
        </Button>
      </Link>
    </Card>
  );
}
