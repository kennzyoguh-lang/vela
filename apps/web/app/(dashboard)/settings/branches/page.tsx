"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Branch, StaffUserSummary } from "@vela/types";
import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api/client";

// Multi-branch — a location tag on Sale/CashReconciliation/User only.
// Invoicing, payroll, compliance, and every connector stay org-wide (see
// the API's schema.prisma comment on the Branch model), so this page is
// deliberately just "name a place, put staff there" — nothing more.
export default function BranchesSettingsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const {
    data: branches,
    isLoading: branchesLoading,
    error: branchesError,
  } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<Branch[]>("/v1/branches"),
  });

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ["organisation-staff"],
    queryFn: () => api.get<StaffUserSummary[]>("/v1/organisation/staff"),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<Branch>("/v1/branches", { name, address: address || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setName("");
      setAddress("");
      setFormError(null);
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Couldn't add this branch."),
  });

  const deactivateMutation = useMutation({
    mutationFn: (branchId: string) => api.post(`/v1/branches/${branchId}/deactivate`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ userId, branchId }: { userId: string; branchId: string | null }) =>
      api.post(`/v1/branches/staff/${userId}/assign`, { branchId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organisation-staff"] }),
    onError: (err) =>
      setAssignError(err instanceof ApiError ? err.message : "Couldn't update that assignment."),
  });

  const salesStaff = staff?.filter((s) => s.role === "staff" || s.role === "admin");

  return (
    <SettingsTemplate activePath="/settings/branches">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Add a branch</CardTitle>
          </CardHeader>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Only needed if the business operates from more than one location — invoicing, payroll,
            and reports stay whole-business either way.
          </p>
          {formError ? <Alert variant="danger" title={formError} /> : null}
          <form
            className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="flex-1">
              <Input
                label="Branch name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <Input
                label="Address (optional)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <Button type="submit" loading={createMutation.isPending} disabled={!name.trim()}>
              Add branch
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branches</CardTitle>
          </CardHeader>
          {branchesLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : branchesError ? (
            <p className="font-ui text-status-danger text-[0.875rem]">
              Couldn&apos;t load — try again shortly.
            </p>
          ) : !branches || branches.length === 0 ? (
            <p className="font-ui text-text-secondary text-[0.875rem]">
              No branches yet — this business is treated as a single location.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {branches.map((branch) => (
                <li
                  key={branch.id}
                  className="border-border flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="font-ui text-text-primary text-[0.875rem] font-semibold">
                      {branch.name}
                    </p>
                    {branch.address ? (
                      <p className="font-ui text-text-secondary text-[0.75rem]">{branch.address}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={
                      deactivateMutation.isPending && deactivateMutation.variables === branch.id
                    }
                    onClick={() => deactivateMutation.mutate(branch.id)}
                  >
                    Deactivate
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {branches && branches.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Assign staff to a branch</CardTitle>
            </CardHeader>
            {assignError ? <Alert variant="danger" title={assignError} /> : null}
            {staffLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : !salesStaff || salesStaff.length === 0 ? (
              <p className="font-ui text-text-secondary text-[0.875rem]">
                No sales staff yet — add one under Users first.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {salesStaff.map((member) => (
                  <li
                    key={member.id}
                    className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <p className="font-ui text-text-primary text-[0.875rem] font-semibold">
                      {member.name}
                    </p>
                    <select
                      value={member.branchId ?? ""}
                      onChange={(e) => {
                        setAssignError(null);
                        assignMutation.mutate({
                          userId: member.id,
                          branchId: e.target.value || null,
                        });
                      }}
                      className="border-border bg-surface-raised font-ui text-text-primary h-9 rounded-sm border px-3 text-[0.8125rem]"
                    >
                      <option value="">No branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
    </SettingsTemplate>
  );
}
