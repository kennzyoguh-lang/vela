"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { api, ApiError } from "@/lib/api/client";

// Mirrors apps/api/src/validation/waitlist.schema.ts's option sets — hand-kept
// in sync until the OpenAPI-generated shared schema pipeline exists (same
// precedent as lib/validation/auth.schema.ts's signupSchema comment).
const PROBLEM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "walk_in_sales_cash_theft", label: "Walk-in sales & cash tracking" },
  { value: "invoicing_late_payments", label: "Invoicing & late payments" },
  { value: "compliance_tax_filing", label: "Tax & compliance filing" },
  { value: "bookkeeping_cashflow", label: "Bookkeeping & cash flow" },
  { value: "other", label: "Something else" },
];

const REVENUE_RANGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "under_1m", label: "Under ₦1m/month" },
  { value: "1m_5m", label: "₦1m – ₦5m/month" },
  { value: "5m_20m", label: "₦5m – ₦20m/month" },
  { value: "over_20m", label: "Over ₦20m/month" },
];

export default function WaitlistPage() {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [revenueRange, setRevenueRange] = useState("");
  const [problem, setProblem] = useState("");

  const joinMutation = useMutation({
    mutationFn: () =>
      api.post("/v1/public/waitlist", {
        businessName,
        ownerName,
        email,
        phone: phone.trim() || null,
        revenueRange,
        problem,
      }),
  });

  if (joinMutation.isSuccess) {
    return (
      <Card className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle2 className="text-sage size-10" aria-hidden />
        <p className="font-ui text-text-primary text-[1.125rem] font-semibold">
          You&apos;re on the list
        </p>
        <p className="font-ui text-text-secondary text-[0.875rem]">
          We&apos;ll email {email} as soon as we're ready for you.
        </p>
      </Card>
    );
  }

  const canSubmit =
    businessName.trim() && ownerName.trim() && email.trim() && revenueRange && problem;

  return (
    <>
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-ui text-text-primary text-[1.5rem] font-bold">Join the waitlist</h1>
        <p className="font-ui text-text-secondary text-[0.9375rem]">
          Invoicing, cash reconciliation, compliance, and payroll — built for how Nigerian SMEs
          actually run.
        </p>
      </div>

      <form
        className="border-border bg-surface-raised shadow-1 flex flex-col gap-4 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          joinMutation.mutate();
        }}
      >
        <CardHeader>
          <CardTitle>Tell us about your business</CardTitle>
        </CardHeader>

        {joinMutation.isError ? (
          <Alert
            variant="danger"
            title={
              joinMutation.error instanceof ApiError
                ? joinMutation.error.message
                : "Couldn't join the waitlist — try again."
            }
          />
        ) : null}

        <Input
          label="Business name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
        />
        <Input
          label="Your name"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Phone (optional)"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="revenueRange"
            className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]"
          >
            Monthly revenue
          </label>
          <select
            id="revenueRange"
            value={revenueRange}
            onChange={(e) => setRevenueRange(e.target.value)}
            className="border-border bg-surface-raised font-ui text-text-primary h-10 rounded-sm border px-3"
            required
          >
            <option value="" disabled>
              Choose one
            </option>
            {REVENUE_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="problem"
            className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]"
          >
            What's your biggest problem right now?
          </label>
          <select
            id="problem"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            className="border-border bg-surface-raised font-ui text-text-primary h-10 rounded-sm border px-3"
            required
          >
            <option value="" disabled>
              Choose one
            </option>
            {PROBLEM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={!canSubmit}
          loading={joinMutation.isPending}
        >
          Join the waitlist
        </Button>
      </form>
    </>
  );
}
