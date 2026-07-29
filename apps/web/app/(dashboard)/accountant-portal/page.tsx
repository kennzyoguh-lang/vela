"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import {
  AccountantLinkCard,
  type AccountantLinkSummary,
} from "@/components/modules/AccountantLinkCard";
import { api, ApiError } from "@/lib/api/client";
import { useState } from "react";

export default function AccountantPortalPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: links, isLoading } = useQuery({
    queryKey: ["accountant-portal", "links"],
    queryFn: () => api.get<AccountantLinkSummary[]>("/v1/accountant-portal/links"),
    staleTime: 30_000,
  });

  const acceptMutation = useMutation({
    mutationFn: (linkId: string) => api.post(`/v1/accountant-portal/links/${linkId}/accept`),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["accountant-portal", "links"] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't accept the invitation."),
  });

  const pending = (links ?? []).filter((l) => l.status === "pending");
  const active = (links ?? []).filter((l) => l.status === "active");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-text-primary text-[1.5rem] font-bold">
          Accountant Portal
        </h1>
        <p className="font-ui text-text-secondary text-[0.875rem]">
          One login, all your clients — read-only summaries for every org that's linked you in.
        </p>
      </div>

      {error ? <Alert variant="danger" title={error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
        </CardHeader>
        {isLoading ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">No pending invitations.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((link) => (
              <AccountantLinkCard
                key={link.id}
                link={link}
                onAccept={(linkId) => acceptMutation.mutate(linkId)}
                accepting={acceptMutation.isPending}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your clients</CardTitle>
        </CardHeader>
        {isLoading ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">Loading…</p>
        ) : active.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No linked client organisations yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {active.map((link) => (
              <AccountantLinkCard key={link.id} link={link} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
