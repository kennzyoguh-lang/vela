"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ComplianceFiling, ComplianceObligation, FilingStatus } from "@vela/types";
import { ListTemplate } from "@/components/templates/ListTemplate";
import { ComplianceFilingCard } from "@/components/modules/ComplianceFilingCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { filingStatusLabel } from "@/lib/compliance-status";
import { api } from "@/lib/api/client";

const FILTERS: { label: string; value: FilingStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: filingStatusLabel("due_soon"), value: "due_soon" },
  { label: filingStatusLabel("overdue"), value: "overdue" },
  { label: filingStatusLabel("upcoming"), value: "upcoming" },
  { label: filingStatusLabel("filed"), value: "filed" },
];

export default function CompliancePage() {
  const [status, setStatus] = useState<FilingStatus | "all">("all");

  const { data: filings, isLoading } = useQuery({
    queryKey: ["compliance", "filings"],
    queryFn: () => api.get<ComplianceFiling[]>("/v1/compliance/filings"),
    staleTime: 30_000,
  });

  const { data: obligations } = useQuery({
    queryKey: ["compliance", "obligations"],
    queryFn: () => api.get<ComplianceObligation[]>("/v1/compliance/obligations"),
    staleTime: 5 * 60_000,
  });

  const obligationByType = useMemo(() => {
    const map = new Map<string, ComplianceObligation>();
    obligations?.forEach((o) => map.set(o.type, o));
    return map;
  }, [obligations]);

  const visibleFilings = filings?.filter((f) => status === "all" || f.status === status) ?? [];
  const noObligationsEnabled = obligations && obligations.every((o) => !o.isActive);

  return (
    <ListTemplate
      title="Compliance"
      primaryAction={
        <Link href="/compliance/settings">
          <Button variant="secondary">Manage obligations</Button>
        </Link>
      }
      filters={FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => setStatus(f.value)}
          className={`font-ui rounded-pill h-11 px-3 text-[0.8125rem] font-semibold transition-colors ${
            status === f.value
              ? "bg-midnight text-white"
              : "bg-surface-secondary text-text-secondary hover:bg-surface-raised"
          }`}
        >
          {f.label}
        </button>
      ))}
    >
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : noObligationsEnabled ? (
        <Card>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No obligations switched on yet.{" "}
            <Link href="/compliance/settings" className="text-data-aiAccent hover:underline">
              Choose which ones apply to your business
            </Link>{" "}
            to start tracking deadlines.
          </p>
        </Card>
      ) : visibleFilings.length === 0 ? (
        <Card>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No filings
            {status === "all"
              ? " yet"
              : ` with status "${filingStatusLabel(status as FilingStatus)}"`}
            .
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleFilings.map((filing) => {
            const obligation = obligationByType.get(filing.obligationType);
            return obligation ? (
              <ComplianceFilingCard key={filing.id} filing={filing} obligation={obligation} />
            ) : null;
          })}
        </div>
      )}
    </ListTemplate>
  );
}
