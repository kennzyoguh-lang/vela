"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { calculateFirsPenalties, type FirsObligation, type PenaltyBreakdown } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { formatMoney } from "@/lib/format";
import { api, ApiError } from "@/lib/api/client";

const OBLIGATION_LABEL: Record<FirsObligation, string> = {
  vat: "VAT",
  wht: "Withholding Tax (WHT)",
  cit: "Companies Income Tax (CIT)",
};

// "YYYY-MM-DD" (from a native date input) -> a full ISO datetime string, the
// format the API's zod schema requires. Local calculation below uses the raw
// date-only string directly (new Date("YYYY-MM-DD") already parses as UTC
// midnight), so this conversion only matters for the network request.
function toIsoOrNull(dateOnly: string): string | null {
  return dateOnly ? `${dateOnly}T00:00:00Z` : null;
}

function ObligationRow({
  obligation,
  breakdown,
}: {
  obligation: FirsObligation;
  breakdown: PenaltyBreakdown;
}) {
  return (
    <div className="border-border flex flex-col gap-1 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <span className="font-ui text-text-primary text-[0.9375rem] font-semibold">
          {OBLIGATION_LABEL[obligation]}
        </span>
        <span className="font-ui text-text-primary text-[1.0625rem] font-bold">
          {formatMoney(breakdown.totalToDate, "NGN")}
        </span>
      </div>
      {breakdown.monthsLate > 0 ? (
        <p className="font-ui text-text-secondary text-[0.8125rem]">
          {breakdown.monthsLate} month{breakdown.monthsLate === 1 ? "" : "s"} late —{" "}
          {formatMoney(breakdown.filingPenalty, "NGN")} filing penalty
          {breakdown.paymentPenalty > 0
            ? ` + ${formatMoney(breakdown.paymentPenalty, "NGN")} payment/interest`
            : ""}
        </p>
      ) : (
        <p className="font-ui text-text-secondary text-[0.8125rem]">
          No penalty estimated from what you entered.
        </p>
      )}
      {breakdown.disclaimer ? (
        <p className="font-ui text-gold-dark flex items-start gap-1.5 text-[0.75rem]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {breakdown.disclaimer}
        </p>
      ) : null}
    </div>
  );
}

export default function FirsCalculatorPage() {
  const router = useRouter();

  const [lastVatFiledAt, setLastVatFiledAt] = useState("");
  const [monthlyVat, setMonthlyVat] = useState("");
  const [lastWhtRemittedAt, setLastWhtRemittedAt] = useState("");
  const [monthlyWht, setMonthlyWht] = useState("");
  const [citLastFiledYear, setCitLastFiledYear] = useState("");

  const [showCapture, setShowCapture] = useState(false);
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [captureError, setCaptureError] = useState<string | null>(null);

  const result = useMemo(
    () =>
      calculateFirsPenalties({
        lastVatFiledAt: lastVatFiledAt || null,
        monthlyVat: Number(monthlyVat) || 0,
        lastWhtRemittedAt: lastWhtRemittedAt || null,
        monthlyWht: Number(monthlyWht) || 0,
        citLastFiledYear: citLastFiledYear ? Number(citLastFiledYear) : null,
        // CIT payment/interest penalties aren't estimated (only filing —
        // see firs-penalty-calculator.ts), so there's nothing this input
        // would actually change; not collected from the visitor.
        monthlyCit: 0,
      }),
    [lastVatFiledAt, monthlyVat, lastWhtRemittedAt, monthlyWht, citLastFiledYear],
  );

  const hasAnyInput =
    lastVatFiledAt.trim() !== "" ||
    lastWhtRemittedAt.trim() !== "" ||
    citLastFiledYear.trim() !== "";

  const captureMutation = useMutation({
    mutationFn: () =>
      api.post("/v1/public/calculator-leads", {
        email,
        businessName,
        lastVatFiledAt: toIsoOrNull(lastVatFiledAt),
        monthlyVat: Number(monthlyVat) || 0,
        lastWhtRemittedAt: toIsoOrNull(lastWhtRemittedAt),
        monthlyWht: Number(monthlyWht) || 0,
        citLastFiledYear: citLastFiledYear ? Number(citLastFiledYear) : null,
        monthlyCit: 0,
      }),
    onSuccess: () => {
      const params = new URLSearchParams({ email, orgName: businessName });
      router.push(`/signup?${params.toString()}`);
    },
    onError: (err) =>
      setCaptureError(err instanceof ApiError ? err.message : "Couldn't save that — try again."),
  });

  return (
    <>
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-ui text-text-primary text-[1.5rem] font-bold">
          FIRS Penalty Calculator
        </h1>
        <p className="font-ui text-text-secondary text-[0.9375rem]">
          See roughly what late VAT, WHT, and CIT filings are costing you under Nigeria&apos;s 2025
          tax reform.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <CardHeader>
          <CardTitle>Your filing history</CardTitle>
        </CardHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Last VAT filed"
            type="date"
            value={lastVatFiledAt}
            onChange={(e) => setLastVatFiledAt(e.target.value)}
          />
          <Input
            label="Monthly VAT amount (₦)"
            type="number"
            min="0"
            value={monthlyVat}
            onChange={(e) => setMonthlyVat(e.target.value)}
          />
          <Input
            label="Last WHT remitted"
            type="date"
            value={lastWhtRemittedAt}
            onChange={(e) => setLastWhtRemittedAt(e.target.value)}
          />
          <Input
            label="Monthly WHT amount (₦)"
            type="number"
            min="0"
            value={monthlyWht}
            onChange={(e) => setMonthlyWht(e.target.value)}
          />
          <Input
            label="CIT last filed (year)"
            type="number"
            min="2000"
            max="2100"
            helperText="e.g. 2024"
            value={citLastFiledYear}
            onChange={(e) => setCitLastFiledYear(e.target.value)}
            className="sm:col-span-2"
          />
        </div>
      </Card>

      {hasAnyInput ? (
        <Card className="flex flex-col gap-4">
          <CardHeader>
            <CardTitle>Estimated penalties</CardTitle>
          </CardHeader>

          <div className="flex flex-col gap-3">
            {result.rankedByUrgency.map(({ obligation }) => (
              <ObligationRow
                key={obligation}
                obligation={obligation}
                breakdown={result[obligation]}
              />
            ))}
          </div>

          <div className="border-border flex items-center justify-between border-t pt-3">
            <span className="font-ui text-text-secondary text-[0.875rem] font-semibold">
              Total estimated
            </span>
            <span className="font-ui text-text-primary text-[1.375rem] font-bold">
              {formatMoney(result.totalPenalty, "NGN")}
            </span>
          </div>

          <Alert variant="warning" title="This is an estimate, not tax advice">
            Confirm your exact obligations with FIRS or your accountant before relying on any of
            these figures.
          </Alert>

          {!showCapture ? (
            <Button className="w-full" onClick={() => setShowCapture(true)}>
              Email me this report
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              {captureError ? <Alert variant="danger" title={captureError} /> : null}
              <Input
                label="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button
                className="w-full"
                disabled={!email.trim() || !businessName.trim()}
                loading={captureMutation.isPending}
                onClick={() => captureMutation.mutate()}
              >
                Send my report &amp; start fixing this
              </Button>
            </div>
          )}
        </Card>
      ) : null}
    </>
  );
}
