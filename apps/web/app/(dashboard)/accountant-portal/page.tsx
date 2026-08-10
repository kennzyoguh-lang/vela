"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountantEarningsSummary, ReferralTier } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  AccountantLinkCard,
  type AccountantLinkSummary,
} from "@/components/modules/AccountantLinkCard";
import { api, ApiError } from "@/lib/api/client";
import { useState } from "react";

const TIER_LABEL: Record<ReferralTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

// GTM Channel 4 — this firm's own referral/client-growth earnings, not a
// client-org summary. amountOwed is deliberately never shown as a naira
// figure here: it's null until real subscription billing exists to compute
// it against (accountant-earning.service.ts's comment has the full reason).
function EarningsCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["accountant-portal", "earnings"],
    queryFn: () => api.get<AccountantEarningsSummary>("/v1/accountant-portal/earnings"),
    staleTime: 60_000,
  });

  return (
    <Card accent className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle eyebrow>Your earnings</CardTitle>
      </CardHeader>
      {error ? (
        <Alert variant="danger" title="Couldn't load your earnings — try again shortly." />
      ) : isLoading || !data ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="font-ui text-text-secondary text-[0.875rem]">Businesses referred</span>
            <span className="font-data text-text-primary text-[1.25rem] font-bold tabular-nums">
              {data.lifetimeReferralCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-ui text-text-secondary text-[0.875rem]">Tier</span>
            <span className="font-data text-gold text-[0.8rem] font-bold uppercase tracking-[0.04em]">
              {TIER_LABEL[data.tier]}
            </span>
          </div>
          {data.monthlyHistory.length > 0 ? (
            <table className="font-ui w-full text-[0.8125rem]">
              <thead>
                <tr className="text-text-secondary text-left">
                  <th className="font-semibold">Month</th>
                  <th className="font-semibold">Referred</th>
                  <th className="font-semibold">Active clients</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyHistory.map((row) => (
                  <tr key={row.month} className="text-text-primary">
                    <td>{row.month}</td>
                    <td className="font-data tabular-nums">{row.referredCount}</td>
                    <td className="font-data tabular-nums">{row.activeClientCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="font-ui text-text-secondary text-[0.8125rem]">
              No monthly history yet — this fills in from the 1st of next month.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

export default function AccountantPortalPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const {
    data: links,
    isLoading,
    error: linksError,
  } = useQuery({
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
      <PageHeader eyebrow="Accountant Portal" title="Accountant Portal" />
      <p className="font-ui text-text-secondary -mt-2 text-[0.875rem]">
        One login, all your clients — read-only summaries for every org that&apos;s linked you in.
      </p>

      {error ? <Alert variant="danger" title={error} /> : null}
      {linksError ? (
        <Alert variant="danger" title="Couldn't load your accountant links — try again shortly." />
      ) : null}

      <EarningsCard />

      <Card accent>
        <CardHeader>
          <CardTitle eyebrow>Pending invitations</CardTitle>
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
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

      <Card accent>
        <CardHeader>
          <CardTitle eyebrow>Your clients</CardTitle>
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
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
