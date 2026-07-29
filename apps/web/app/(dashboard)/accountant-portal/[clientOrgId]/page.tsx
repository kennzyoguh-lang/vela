"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText, Landmark, ShieldCheck, Users } from "lucide-react";
import { DetailTemplate } from "@/components/templates/DetailTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { formatMoney } from "@/lib/format";
import {
  filingBadgeStatus,
  filingStatusLabel,
  formatFilingDuePhrase,
} from "@/lib/compliance-status";
import { api, ApiError } from "@/lib/api/client";
import { Badge } from "@/components/ui/Badge";

interface ClientOrgSummary {
  orgName: string;
  baseCurrency: string;
  outstandingInvoicesTotal: number;
  outstandingInvoicesCount: number;
  nextComplianceFiling: {
    obligationType: string;
    periodLabel: string;
    dueDate: string;
    status: "upcoming" | "due_soon" | "overdue" | "filed";
  } | null;
  cashPosition: number;
  currentPayrollRun: {
    periodLabel: string;
    status: string;
    totalNetPay: string;
  } | null;
}

export default function ClientOrgSummaryPage() {
  const params = useParams<{ clientOrgId: string }>();

  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["accountant-portal", "client-orgs", params.clientOrgId, "summary"],
    queryFn: () =>
      api.get<ClientOrgSummary>(`/v1/accountant-portal/client-orgs/${params.clientOrgId}/summary`),
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Alert
        variant="danger"
        title={
          error instanceof ApiError ? error.message : "You don't have access to this organisation."
        }
      />
    );
  }

  return (
    <DetailTemplate
      header={
        <div>
          <h1 className="font-display text-text-primary text-[1.5rem] font-bold">
            {summary.orgName}
          </h1>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Read-only summary — client of the Accountant Portal
          </p>
        </div>
      }
      main={
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="flex flex-col gap-2">
            <CardHeader>
              <CardTitle>Outstanding invoices</CardTitle>
              <FileText className="text-text-secondary size-4" aria-hidden />
            </CardHeader>
            <p className="font-ui text-text-primary text-[1.25rem] font-bold">
              {formatMoney(summary.outstandingInvoicesTotal, summary.baseCurrency)}
            </p>
            <p className="font-ui text-text-secondary text-[0.8125rem]">
              {summary.outstandingInvoicesCount} invoice
              {summary.outstandingInvoicesCount === 1 ? "" : "s"} outstanding
            </p>
          </Card>

          <Card className="flex flex-col gap-2">
            <CardHeader>
              <CardTitle>Cash position</CardTitle>
              <Landmark className="text-text-secondary size-4" aria-hidden />
            </CardHeader>
            <p className="font-ui text-text-primary text-[1.25rem] font-bold">
              {formatMoney(summary.cashPosition, summary.baseCurrency)}
            </p>
          </Card>

          <Card className="flex flex-col gap-2">
            <CardHeader>
              <CardTitle>Compliance</CardTitle>
              <ShieldCheck className="text-text-secondary size-4" aria-hidden />
            </CardHeader>
            {!summary.nextComplianceFiling ? (
              <p className="font-ui text-text-secondary text-[0.875rem]">
                Nothing due — all caught up.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <p className="font-ui text-text-primary text-[0.875rem] font-semibold uppercase">
                    {summary.nextComplianceFiling.obligationType.replace(/_/g, " ")}
                  </p>
                  <Badge
                    status={filingBadgeStatus(summary.nextComplianceFiling.status)}
                    label={filingStatusLabel(summary.nextComplianceFiling.status)}
                  />
                </div>
                <p className="font-ui text-text-secondary text-[0.8125rem]">
                  {summary.nextComplianceFiling.periodLabel} ·{" "}
                  {formatFilingDuePhrase(
                    summary.nextComplianceFiling.dueDate,
                    summary.nextComplianceFiling.status,
                  )}
                </p>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-2">
            <CardHeader>
              <CardTitle>Payroll</CardTitle>
              <Users className="text-text-secondary size-4" aria-hidden />
            </CardHeader>
            {!summary.currentPayrollRun ? (
              <p className="font-ui text-text-secondary text-[0.875rem]">
                No payroll run yet for this period.
              </p>
            ) : (
              <p className="font-ui text-text-primary text-[0.875rem]">
                <span className="text-[1.25rem] font-bold">
                  {formatMoney(summary.currentPayrollRun.totalNetPay, summary.baseCurrency)}
                </span>{" "}
                {summary.currentPayrollRun.status === "paid" ? "paid" : "pending"} for{" "}
                {summary.currentPayrollRun.periodLabel}
              </p>
            )}
          </Card>
        </div>
      }
      rail={
        <Card>
          <CardHeader>
            <CardTitle>About this view</CardTitle>
          </CardHeader>
          <p className="font-ui text-text-secondary text-[0.8125rem]">
            You're seeing a read-only summary as a linked accountant. The client organisation can
            revoke this access at any time from their Settings.
          </p>
        </Card>
      }
    />
  );
}
