"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee, PayrollRunDetail } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { PayslipRow } from "@/components/modules/PayslipRow";
import { formatMoney } from "@/lib/format";
import { api, ApiError, downloadAuthenticatedFile } from "@/lib/api/client";

export default function PayrollRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: run, isLoading } = useQuery({
    queryKey: ["payroll-runs", params.runId],
    queryFn: () => api.get<PayrollRunDetail>(`/v1/payroll-runs/${params.runId}`),
    staleTime: 30_000,
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get<Employee[]>("/v1/employees"),
    staleTime: 60_000,
  });

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    employees?.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const markPaidMutation = useMutation({
    mutationFn: () => api.post(`/v1/payroll-runs/${params.runId}/mark-paid`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs", params.runId] });
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
    },
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Couldn't mark this run as paid."),
  });

  async function handleExportCsv() {
    setActionError(null);
    try {
      await downloadAuthenticatedFile(
        `/v1/payroll-runs/${params.runId}/export.csv`,
        `payroll-${run?.periodLabel ?? params.runId}.csv`,
      );
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't export this run.");
    }
  }

  if (isLoading || !run) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-data text-gold mb-2 text-[0.7rem] font-bold uppercase tracking-[0.14em]">
            Payroll
          </p>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-text-primary text-[1.75rem] font-normal leading-tight">
              {run.periodLabel}
            </h1>
            <Badge
              status={run.status === "paid" ? "active" : "draft"}
              label={run.status === "paid" ? "Paid" : "Draft"}
            />
          </div>
          <p className="font-ui text-text-secondary mt-1 text-[0.875rem]">
            {run.payslips.length} employee{run.payslips.length === 1 ? "" : "s"} · Total net pay{" "}
            <span className="font-data tabular-nums">{formatMoney(run.totalNetPay, "NGN")}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExportCsv}>
            Export CSV
          </Button>
          {run.status === "draft" ? (
            <Button loading={markPaidMutation.isPending} onClick={() => markPaidMutation.mutate()}>
              Mark as paid
            </Button>
          ) : null}
        </div>
      </div>

      {actionError ? <Alert variant="danger" title={actionError} /> : null}

      <Card accent>
        <CardHeader>
          <CardTitle eyebrow>Totals</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-ui text-text-secondary text-[0.875rem]">Gross pay</span>
            <span className="font-data text-text-primary text-[0.875rem] tabular-nums">
              {formatMoney(run.totalGrossPay, "NGN")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-ui text-text-secondary text-[0.875rem]">Deductions</span>
            <span className="font-data text-text-primary text-[0.875rem] tabular-nums">
              {formatMoney(run.totalDeductions, "NGN")}
            </span>
          </div>
          <div className="border-border flex items-center justify-between border-t pt-2">
            <span className="font-ui text-text-primary text-[1rem] font-bold">Net pay</span>
            <span className="font-data text-sage text-[1.125rem] font-bold tabular-nums">
              {formatMoney(run.totalNetPay, "NGN")}
            </span>
          </div>
        </div>
      </Card>

      <Card accent>
        <CardHeader>
          <CardTitle eyebrow>Payslips</CardTitle>
        </CardHeader>
        {run.payslips.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No employees were active when this run was computed.
          </p>
        ) : (
          <div className="flex flex-col">
            {run.payslips.map((payslip) => {
              const employee = employeeById.get(payslip.employeeId);
              return (
                <PayslipRow
                  key={payslip.id}
                  payslip={payslip}
                  employeeName={employee?.name ?? "Unknown employee"}
                  employeeJobTitle={employee?.jobTitle ?? ""}
                />
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
