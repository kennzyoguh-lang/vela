"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";

export default function ReferralLandingPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["public", "referral-code", params.code],
    queryFn: () => api.get<{ valid: boolean }>(`/v1/public/referral-codes/${params.code}`),
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const isValid = data?.valid ?? false;
  const signupHref = isValid
    ? `/signup?${new URLSearchParams({ referredBy: params.code }).toString()}`
    : "/signup";

  return (
    <Card className="flex flex-col items-center gap-3 py-8 text-center">
      <CardHeader className="mb-0 flex-col">
        <CardTitle className="text-[1.25rem]">
          {isValid ? "You've been invited to VELA" : "Welcome to VELA"}
        </CardTitle>
      </CardHeader>
      <p className="font-ui text-text-secondary text-[0.9375rem]">
        Invoicing, cash reconciliation, compliance tracking, and payroll — built for how Nigerian
        SMEs actually run.
      </p>
      <Button className="mt-2 w-full" onClick={() => router.push(signupHref)}>
        Create your free account
      </Button>
    </Card>
  );
}
