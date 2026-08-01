"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { computeModuleDefaults, MODULE_KEYS, type ModuleKey } from "@vela/types";
import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import type { BusinessProfileResponse } from "@/lib/business-profile/useModuleVisibility";

// Requirement 4 — module visibility is always a DEFAULT, never a hard
// restriction. This page is the one place an owner/admin can reveal a
// module the onboarding factors hid, or hide one they don't want, without
// changing the underlying factor answers themselves (those live on
// /onboarding and are re-confirmed separately, see graduation prompts).
const MODULE_LABELS: Record<ModuleKey, { label: string; description: string }> = {
  quickSale: {
    label: "Quick Sale",
    description: "Fast one-off sale logging for walk-in, one-time customers.",
  },
  invoicing: {
    label: "Invoicing",
    description: "Bill repeat customers and track payment status.",
  },
  cashReconciliation: {
    label: "Cash Check",
    description: "End-of-day cash checks against staff-logged sales.",
  },
  inventoryReorder: {
    label: "Low-stock alerts",
    description: "Reorder nudges when product stock runs low.",
  },
  compliance: {
    label: "Compliance tracking",
    description: "Filing deadlines and reminders.",
  },
  payroll: {
    label: "Payroll",
    description: "Staff pay runs and PAYE calculation.",
  },
  fullPnl: {
    label: "Full P&L (Profit & Loss)",
    description: "Full profit & loss breakdown on the Money page.",
  },
  accountantPortal: {
    label: "Accountant portal",
    description: "Give your accountant read access to your books.",
  },
};

export default function ModulesSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["business-profile"],
    queryFn: () => api.get<BusinessProfileResponse>("/v1/organisation/business-profile"),
  });

  const overrideMutation = useMutation({
    mutationFn: ({ moduleKey, value }: { moduleKey: ModuleKey; value: boolean | null }) =>
      api.patch("/v1/organisation/business-profile/module-override", { moduleKey, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-profile"] });
    },
  });

  const factors = data ?? {
    customerPattern: "unsure" as const,
    hasSalesStaff: "unsure" as const,
    isCacRegistered: "unsure" as const,
  };
  const defaults = computeModuleDefaults(factors);
  const overrides = data?.moduleOverrides ?? {};

  return (
    <SettingsTemplate activePath="/settings/modules">
      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
        </CardHeader>
        <p className="font-ui text-text-secondary mb-4 text-[0.875rem]">
          Based on your answers during setup, we show or hide these by default. Turn any of them on
          or off here — this never changes your setup answers, only what you see.
        </p>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {MODULE_KEYS.map((moduleKey) => {
              const isOverridden = overrides[moduleKey] !== undefined;
              const isOn = overrides[moduleKey] ?? defaults[moduleKey];
              const { label, description } = MODULE_LABELS[moduleKey];
              return (
                <li
                  key={moduleKey}
                  className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-ui text-text-primary text-[0.875rem] font-semibold">
                      {label}
                    </p>
                    <p className="font-ui text-text-secondary text-[0.75rem]">{description}</p>
                    {isOverridden ? (
                      <button
                        type="button"
                        onClick={() => overrideMutation.mutate({ moduleKey, value: null })}
                        className="font-ui text-gold mt-1 text-[0.75rem] font-semibold underline"
                      >
                        Reset to default ({defaults[moduleKey] ? "on" : "off"})
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    aria-label={`${isOn ? "Hide" : "Show"} ${label}`}
                    onClick={() => overrideMutation.mutate({ moduleKey, value: !isOn })}
                    disabled={overrideMutation.isPending}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center"
                  >
                    <span
                      aria-hidden
                      className={`relative h-7 w-12 rounded-full transition-colors ${
                        isOn ? "bg-gold" : "bg-surface-secondary"
                      }`}
                    >
                      <span
                        className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${
                          isOn ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </SettingsTemplate>
  );
}
