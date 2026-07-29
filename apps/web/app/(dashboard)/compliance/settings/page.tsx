"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ComplianceObligation, ComplianceObligationType } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";

// Necessary infrastructure for the Compliance module, not itself a nav item —
// same precedent as /clients relative to /invoices.
export default function ComplianceSettingsPage() {
  const queryClient = useQueryClient();

  const { data: obligations, isLoading } = useQuery({
    queryKey: ["compliance", "obligations"],
    queryFn: () => api.get<ComplianceObligation[]>("/v1/compliance/obligations"),
    staleTime: 5 * 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ type, isActive }: { type: ComplianceObligationType; isActive: boolean }) =>
      api.patch(`/v1/compliance/obligations/${type}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", "obligations"] });
      queryClient.invalidateQueries({ queryKey: ["compliance", "filings"] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-ui text-text-primary text-[1.5rem] font-bold">Compliance obligations</h1>
      <p className="font-ui text-text-secondary text-[0.875rem]">
        Switch on the obligations that apply to your business — VELA tracks their deadlines and
        reminds you before they're due.
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {obligations?.map((obligation) => (
            <Card key={obligation.type} className="flex items-center justify-between gap-4">
              <div>
                <CardHeader className="mb-1">
                  <CardTitle>{obligation.label}</CardTitle>
                </CardHeader>
                <p className="font-ui text-text-secondary text-[0.8125rem]">
                  {obligation.description}
                </p>
                <p className="font-ui text-text-secondary mt-1 text-[0.75rem] uppercase tracking-[0.02em]">
                  {obligation.authority} · {obligation.frequency}
                </p>
              </div>
              <Button
                variant={obligation.isActive ? "secondary" : "primary"}
                size="sm"
                loading={
                  toggleMutation.isPending && toggleMutation.variables?.type === obligation.type
                }
                onClick={() =>
                  toggleMutation.mutate({ type: obligation.type, isActive: !obligation.isActive })
                }
              >
                {obligation.isActive ? "Turn off" : "Turn on"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
