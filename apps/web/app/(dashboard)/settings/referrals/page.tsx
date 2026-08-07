"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check } from "lucide-react";
import type { ReferralSummary, ReferralTier } from "@vela/types";
import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";

const TIER_LABEL: Record<ReferralTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export default function ReferralsSettingsPage() {
  const [copied, setCopied] = useState(false);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["organisation", "referral-summary"],
    queryFn: () => api.get<ReferralSummary>("/v1/organisation/referral-summary"),
  });

  // Built from the browser's own origin, not an env var — this page is
  // never server-rendered with a real URL to share (Next statically
  // prerenders nothing that depends on window), and the share link must
  // always point at wherever the owner is actually using the app from.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralUrl = summary ? `${origin}/refer/${summary.code}` : "";

  return (
    <SettingsTemplate activePath="/settings/referrals">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <CardHeader>
            <CardTitle>Your referral link</CardTitle>
          </CardHeader>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Share this link with other business owners. Once someone you referred pays their first
            invoice or collects their first Quick Sale, you earn a reward.
          </p>

          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="border-border bg-surface-secondary font-ui text-text-primary h-10 flex-1 overflow-x-auto whitespace-nowrap rounded-sm border px-3 py-2 text-[0.875rem]">
                {referralUrl}
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(referralUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <CardHeader>
            <CardTitle>Your rewards</CardTitle>
          </CardHeader>

          {isLoading || !summary ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-ui text-text-secondary text-[0.875rem]">
                  Successful referrals
                </span>
                <span className="font-ui text-text-primary text-[1.25rem] font-bold">
                  {summary.conversionCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-ui text-text-secondary text-[0.875rem]">Tier</span>
                <span className="font-ui text-gold-dark text-[0.9375rem] font-semibold">
                  {TIER_LABEL[summary.tier]}
                </span>
              </div>
              {summary.rewardsDescription.length > 0 ? (
                <ul className="flex flex-col gap-1 pt-2">
                  {summary.rewardsDescription.map((reward, i) => (
                    <li key={i} className="font-ui text-text-secondary text-[0.8125rem]">
                      {reward}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-ui text-text-secondary text-[0.8125rem]">
                  No rewards yet — share your link to get started.
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </SettingsTemplate>
  );
}
