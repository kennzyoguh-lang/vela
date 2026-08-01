"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { CustomerPattern, YesNoUnsure } from "@vela/types";
import { api, ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
}

// Plain-language questions only — no "Factor A/B/C", no "profile score"
// anywhere a user can see it (Requirement 3). Each has a genuine third
// option, never a forced yes/no, since "unsure/mixed" is a real answer for
// all three (see packages/types/src/business-profile.ts).
const CUSTOMER_PATTERN_OPTIONS: Option<CustomerPattern>[] = [
  { value: "one_time", label: "They mostly pay once and leave" },
  { value: "repeat", label: "They mostly come back regularly" },
  { value: "unsure", label: "It's a mix, or I'm not sure" },
];

const YES_NO_UNSURE_OPTIONS: Option<YesNoUnsure>[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];

function QuestionCard<T extends string>({
  question,
  helperText,
  options,
  value,
  onChange,
}: {
  question: string;
  helperText?: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-ui text-text-primary text-[0.9375rem] font-semibold">{question}</p>
      {helperText ? (
        <p className="font-ui text-text-secondary -mt-1 text-[0.8125rem]">{helperText}</p>
      ) : null}
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "font-ui rounded-md border px-4 py-3 text-left text-[0.9375rem] transition-colors",
              value === option.value
                ? "border-data-aiAccent bg-data-aiAccent/10 text-text-primary font-semibold"
                : "border-border bg-surface-raised text-text-primary hover:bg-surface-secondary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [customerPattern, setCustomerPattern] = useState<CustomerPattern | null>(null);
  const [hasSalesStaff, setHasSalesStaff] = useState<YesNoUnsure | null>(null);
  const [isCacRegistered, setIsCacRegistered] = useState<YesNoUnsure | null>(null);

  const mutation = useMutation({
    mutationFn: (factors: {
      customerPattern: CustomerPattern;
      hasSalesStaff: YesNoUnsure;
      isCacRegistered: YesNoUnsure;
    }) => api.patch("/v1/organisation/business-profile/factors", factors),
    onSuccess: () => router.push("/"),
  });

  function handleContinue() {
    mutation.mutate({
      customerPattern: customerPattern ?? "unsure",
      hasSalesStaff: hasSalesStaff ?? "unsure",
      isCacRegistered: isCacRegistered ?? "unsure",
    });
  }

  function handleSkip() {
    mutation.mutate({
      customerPattern: "unsure",
      hasSalesStaff: "unsure",
      isCacRegistered: "unsure",
    });
  }

  const allAnswered =
    customerPattern !== null && hasSalesStaff !== null && isCacRegistered !== null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-ui text-text-primary text-[1.25rem] font-semibold">
          A few quick questions
        </h1>
        <p className="font-ui text-text-secondary mt-1 text-[0.875rem]">
          This helps us show you the tools that actually fit your business — you can change any of
          this later in Settings, and nothing here is required.
        </p>
      </div>

      {mutation.isError ? (
        <Alert
          variant="danger"
          title={
            mutation.error instanceof ApiError
              ? mutation.error.message
              : "Couldn't save this — try again"
          }
        />
      ) : null}

      <QuestionCard
        question="Do most of your customers pay once and leave, or come back regularly?"
        options={CUSTOMER_PATTERN_OPTIONS}
        value={customerPattern}
        onChange={setCustomerPattern}
      />

      <QuestionCard
        question="Do you have staff who handle sales or cash?"
        options={YES_NO_UNSURE_OPTIONS}
        value={hasSalesStaff}
        onChange={setHasSalesStaff}
      />

      <QuestionCard
        question="Is your business registered with CAC?"
        helperText="Nigeria's Corporate Affairs Commission"
        options={YES_NO_UNSURE_OPTIONS}
        value={isCacRegistered}
        onChange={setIsCacRegistered}
      />

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          disabled={!allAnswered}
          loading={mutation.isPending}
          onClick={handleContinue}
        >
          Continue
        </Button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={mutation.isPending}
          className="font-ui text-text-secondary text-center text-[0.875rem] hover:underline disabled:opacity-40"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
