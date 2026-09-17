"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ComplianceObligation,
  ComplianceObligationType,
  KycStatus,
  TaxStatus,
} from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api/client";

// Nigeria Tax Act 2025 (effective 1 Jan 2026) — Section 56's "small company"
// status turns on turnover, fixed assets, and professional-services status,
// none of which VELA captures anywhere else. This card is the one place an
// owner supplies them; tax-status.service.ts computes the rest server-side.
// The VAT small-business threshold is deliberately NOT covered here — it
// couldn't be confirmed against an authoritative source, so the disclaimer
// below points people to their accountant rather than risk a wrong number.
function TaxStatusCard() {
  const queryClient = useQueryClient();
  const [turnover, setTurnover] = useState("");
  const [fixedAssets, setFixedAssets] = useState("");
  const [professionalServices, setProfessionalServices] = useState<"yes" | "no" | "">("");

  const { data: taxStatus, isLoading } = useQuery({
    queryKey: ["tax-status"],
    queryFn: () => api.get<TaxStatus>("/v1/organisation/tax-status"),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.patch("/v1/organisation/tax-status", {
        annualTurnover: Number(turnover),
        fixedAssetsValue: Number(fixedAssets),
        providesProfessionalServices: professionalServices === "yes",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-status"] });
    },
  });

  return (
    <Card accent>
      <CardHeader>
        <CardTitle eyebrow>Your tax status</CardTitle>
      </CardHeader>
      <p className="font-ui text-text-secondary text-[0.875rem]">
        Tell us your annual turnover, fixed assets, and whether you provide professional services to
        see whether you qualify as a Small Company under the Nigeria Tax Act 2025.
      </p>

      {isLoading ? (
        <Skeleton className="mt-3 h-20 w-full" />
      ) : (
        <div
          className={`font-ui mt-3 rounded-md p-3 text-[0.875rem] font-semibold ${
            taxStatus?.status === "small"
              ? "bg-sage/15 text-sage"
              : taxStatus?.status === "standard"
                ? "bg-surface-secondary text-text-primary"
                : "bg-surface-secondary text-text-secondary"
          }`}
        >
          {taxStatus?.summary}
        </div>
      )}

      <form
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Input
          label="Annual turnover (₦)"
          type="number"
          min="0"
          step="0.01"
          value={turnover}
          onChange={(e) => setTurnover(e.target.value)}
          required
        />
        <Input
          label="Fixed assets value (₦)"
          type="number"
          min="0"
          step="0.01"
          value={fixedAssets}
          onChange={(e) => setFixedAssets(e.target.value)}
          required
        />
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label
            htmlFor="professionalServices"
            className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]"
          >
            Do you provide professional services? (e.g. legal, accounting, consulting)
          </label>
          <select
            id="professionalServices"
            value={professionalServices}
            onChange={(e) => setProfessionalServices(e.target.value as "yes" | "no" | "")}
            className="border-border bg-surface-raised font-ui text-text-primary h-10 rounded-sm border px-3"
            required
          >
            <option value="" disabled>
              Choose one
            </option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <Button
          type="submit"
          loading={mutation.isPending}
          disabled={!turnover || !fixedAssets || !professionalServices}
          className="sm:col-span-2 sm:self-start"
        >
          Save tax profile
        </Button>
      </form>
      {mutation.isError ? (
        <Alert
          variant="danger"
          title={
            mutation.error instanceof ApiError
              ? mutation.error.message
              : "Couldn't save your tax profile"
          }
        />
      ) : null}

      <p className="font-ui text-text-secondary mt-3 text-[0.75rem]">
        This is guidance, not tax advice — confirm your actual obligations with FIRS or your
        accountant, especially VAT, which this reform&apos;s small-business threshold wasn&apos;t
        clearly published for at the time this was built.
      </p>
    </Card>
  );
}

// KYC — the owner's NIN/BVN on file for the business, the baseline
// identity data CBN-style tiered KYC expects. Verification is honestly
// "pending" for both: Vela has no NIMC or bank BVN-verification API
// credentials yet (kyc.service.ts's own comment explains why), so this
// never claims a check that hasn't actually happened. Submitting either
// value clears it from the input immediately — same write-only treatment
// as a password, it is never shown back.
function KycCard() {
  const queryClient = useQueryClient();
  const [nin, setNin] = useState("");
  const [bvn, setBvn] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: kycStatus, isLoading } = useQuery({
    queryKey: ["kyc-status"],
    queryFn: () => api.get<KycStatus>("/v1/organisation/kyc"),
  });

  const submitNinMutation = useMutation({
    mutationFn: () => api.post("/v1/organisation/kyc/nin", { nin }),
    onSuccess: () => {
      setNin("");
      queryClient.invalidateQueries({ queryKey: ["kyc-status"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't save your NIN."),
  });

  const submitBvnMutation = useMutation({
    mutationFn: () => api.post("/v1/organisation/kyc/bvn", { bvn }),
    onSuccess: () => {
      setBvn("");
      queryClient.invalidateQueries({ queryKey: ["kyc-status"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't save your BVN."),
  });

  function statusBadge(submitted: boolean, verified: boolean) {
    if (verified) return <Badge status="active" label="Verified" />;
    if (submitted) return <Badge status="partial" label="Verification pending" />;
    return <Badge status="draft" label="Not on file" />;
  }

  return (
    <Card accent>
      <CardHeader>
        <CardTitle eyebrow>KYC</CardTitle>
      </CardHeader>
      <p className="font-ui text-text-secondary text-[0.875rem]">
        Your NIN and BVN on file, encrypted and never shown back once saved. Real-time verification
        against NIMC/your bank is coming soon — for now, saving records them as submitted.
      </p>
      {error ? <Alert variant="danger" title={error} /> : null}
      {isLoading ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="border-border rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
              <p className="font-ui text-text-primary text-[0.875rem] font-semibold">NIN</p>
              {statusBadge(kycStatus?.ninSubmitted ?? false, kycStatus?.ninVerified ?? false)}
            </div>
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                submitNinMutation.mutate();
              }}
            >
              <div className="flex-1">
                <Input
                  label="11-digit National Identification Number"
                  value={nin}
                  onChange={(e) => setNin(e.target.value)}
                  maxLength={11}
                  required
                />
              </div>
              <Button
                type="submit"
                size="sm"
                loading={submitNinMutation.isPending}
                disabled={nin.length !== 11}
              >
                Save
              </Button>
            </form>
          </div>
          <div className="border-border rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
              <p className="font-ui text-text-primary text-[0.875rem] font-semibold">BVN</p>
              {statusBadge(kycStatus?.bvnSubmitted ?? false, kycStatus?.bvnVerified ?? false)}
            </div>
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                submitBvnMutation.mutate();
              }}
            >
              <div className="flex-1">
                <Input
                  label="11-digit Bank Verification Number"
                  value={bvn}
                  onChange={(e) => setBvn(e.target.value)}
                  maxLength={11}
                  required
                />
              </div>
              <Button
                type="submit"
                size="sm"
                loading={submitBvnMutation.isPending}
                disabled={bvn.length !== 11}
              >
                Save
              </Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

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
      <PageHeader eyebrow="Compliance" title="Compliance obligations" />
      <p className="font-ui text-text-secondary -mt-2 text-[0.875rem]">
        Switch on the obligations that apply to your business — VELA tracks their deadlines and
        reminds you before they're due.
      </p>

      <TaxStatusCard />
      <KycCard />

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
