"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ComplianceFiling, ComplianceObligation } from "@vela/types";
import { DetailTemplate } from "@/components/templates/DetailTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  filingBadgeStatus,
  filingStatusLabel,
  formatFilingDuePhrase,
} from "@/lib/compliance-status";
import { api, ApiError } from "@/lib/api/client";

export default function ComplianceFilingDetailPage() {
  const params = useParams<{ filingId: string }>();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [filedAt, setFiledAt] = useState(new Date().toISOString().slice(0, 10));
  const [receiptReference, setReceiptReference] = useState("");
  const [notes, setNotes] = useState("");

  const { data: filing, isLoading } = useQuery({
    queryKey: ["compliance", "filings", params.filingId],
    queryFn: () => api.get<ComplianceFiling>(`/v1/compliance/filings/${params.filingId}`),
    staleTime: 30_000,
  });

  const { data: obligations } = useQuery({
    queryKey: ["compliance", "obligations"],
    queryFn: () => api.get<ComplianceObligation[]>("/v1/compliance/obligations"),
    staleTime: 5 * 60_000,
  });

  const obligation = obligations?.find((o) => o.type === filing?.obligationType);

  const markFiledMutation = useMutation({
    mutationFn: () =>
      api.post<ComplianceFiling>(`/v1/compliance/filings/${params.filingId}/mark-filed`, {
        filedAt,
        receiptReference: receiptReference || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", "filings", params.filingId] });
      queryClient.invalidateQueries({ queryKey: ["compliance", "filings"] });
    },
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Couldn't mark this as filed."),
  });

  if (isLoading || !filing || !obligation) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <DetailTemplate
      header={
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-ui text-text-primary text-[1.5rem] font-bold">
              {obligation.label}
            </h1>
            <Badge
              status={filingBadgeStatus(filing.status)}
              label={filingStatusLabel(filing.status)}
            />
          </div>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            {obligation.authority} · {filing.periodLabel} ·{" "}
            {formatFilingDuePhrase(filing.dueDate, filing.status)}
          </p>
        </div>
      }
      main={
        <Card className="flex flex-col gap-4">
          <div>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <p className="font-ui text-text-secondary text-[0.875rem]">{obligation.description}</p>
          </div>
          <div className="border-border border-t pt-4">
            <p className="font-ui text-text-secondary text-[0.75rem] uppercase tracking-[0.02em]">
              Due date
            </p>
            <p className="font-ui text-text-primary text-[0.875rem]">
              {new Date(filing.dueDate).toLocaleDateString()}
            </p>
          </div>

          {filing.status === "filed" ? (
            <div className="border-border border-t pt-4">
              <p className="font-ui text-text-secondary text-[0.75rem] uppercase tracking-[0.02em]">
                Filed
              </p>
              <p className="font-ui text-text-primary text-[0.875rem]">
                {filing.filedAt ? new Date(filing.filedAt).toLocaleDateString() : "—"}
              </p>
              {filing.receiptReference ? (
                <p className="font-ui text-text-secondary mt-1 text-[0.8125rem]">
                  Receipt reference: {filing.receiptReference}
                </p>
              ) : null}
              {filing.notes ? (
                <p className="font-ui text-text-secondary mt-1 text-[0.8125rem]">{filing.notes}</p>
              ) : null}
            </div>
          ) : (
            <div className="border-border flex flex-col gap-3 border-t pt-4">
              <CardHeader>
                <CardTitle>Mark as filed</CardTitle>
              </CardHeader>
              {actionError ? <Alert variant="danger" title={actionError} /> : null}
              <Input
                label="Filed on"
                type="date"
                value={filedAt}
                onChange={(e) => setFiledAt(e.target.value)}
                required
              />
              <Input
                label="Receipt reference"
                helperText="Optional — a payment reference or receipt number from the filing"
                value={receiptReference}
                onChange={(e) => setReceiptReference(e.target.value)}
              />
              <Input
                label="Notes"
                helperText="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button
                loading={markFiledMutation.isPending}
                onClick={() => markFiledMutation.mutate()}
                className="self-start"
              >
                Mark as filed
              </Button>
            </div>
          )}
        </Card>
      }
      rail={
        <Card>
          <CardHeader>
            <CardTitle>About this obligation</CardTitle>
          </CardHeader>
          <p className="font-ui text-text-secondary text-[0.8125rem]">
            {obligation.frequency === "monthly" ? "Filed monthly" : "Filed annually"} with{" "}
            {obligation.authority}.
          </p>
        </Card>
      }
    />
  );
}
