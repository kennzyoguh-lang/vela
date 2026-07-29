"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee, PayrollRun } from "@vela/types";
import { ListTemplate } from "@/components/templates/ListTemplate";
import { EmployeeCard } from "@/components/modules/EmployeeCard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { api, ApiError } from "@/lib/api/client";

function currentPeriodLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PeoplePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [runError, setRunError] = useState<string | null>(null);

  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get<Employee[]>("/v1/employees"),
    staleTime: 60_000,
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: () => api.get<PayrollRun[]>("/v1/payroll-runs"),
    staleTime: 30_000,
  });

  const runPayrollMutation = useMutation({
    mutationFn: () =>
      api.post<PayrollRun>("/v1/payroll-runs/run", { periodLabel: currentPeriodLabel() }),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      router.push(`/people/${run.id}`);
    },
    onError: (err) => setRunError(err instanceof ApiError ? err.message : "Couldn't run payroll."),
  });

  return (
    <div className="flex flex-col gap-6">
      <ListTemplate
        title="Employees"
        primaryAction={
          <Link href="/people/employees/new">
            <Button variant="secondary">Add employee</Button>
          </Link>
        }
      >
        {employeesLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !employees || employees.length === 0 ? (
          <Card>
            <p className="font-ui text-text-secondary text-[0.875rem]">
              No employees yet. Add one to start running payroll.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {employees.map((employee) => (
              <EmployeeCard key={employee.id} employee={employee} />
            ))}
          </div>
        )}
      </ListTemplate>

      <ListTemplate
        title="Payroll"
        primaryAction={
          <Button
            onClick={() => runPayrollMutation.mutate()}
            loading={runPayrollMutation.isPending}
            disabled={!employees || employees.length === 0}
          >
            Run payroll for {currentPeriodLabel()}
          </Button>
        }
      >
        {runError ? <Alert variant="danger" title={runError} /> : null}
        {runsLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !runs || runs.length === 0 ? (
          <Card>
            <p className="font-ui text-text-secondary text-[0.875rem]">No payroll runs yet.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {runs.map((run) => (
              <Link key={run.id} href={`/people/${run.id}`}>
                <Card className="hover:border-data-aiAccent flex items-center justify-between gap-4 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-ui text-text-primary text-[0.875rem] font-semibold">
                        {run.periodLabel}
                      </p>
                      <Badge
                        status={run.status === "paid" ? "active" : "draft"}
                        label={run.status === "paid" ? "Paid" : "Draft"}
                      />
                    </div>
                    <p className="font-ui text-text-secondary text-[0.75rem]">
                      Net pay {formatMoney(run.totalNetPay, "NGN")}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </ListTemplate>

      <Card>
        <CardHeader>
          <CardTitle>About payroll runs</CardTitle>
        </CardHeader>
        <p className="font-ui text-text-secondary text-[0.875rem]">
          Running payroll computes PAYE, pension, and NHF for every active employee. Re-running the
          same month recalculates it — until you mark it as paid, after which it's locked.
        </p>
      </Card>
    </div>
  );
}
