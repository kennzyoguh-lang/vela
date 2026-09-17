"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import {
  DashboardTemplate,
  type DashboardWidgetSlot,
} from "@/components/templates/DashboardTemplate";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import { OutstandingInvoicesWidget } from "@/components/modules/OutstandingInvoicesWidget";
import { LowStockWidget } from "@/components/modules/LowStockWidget";
import { ComplianceWidget } from "@/components/modules/ComplianceWidget";
import { CashPositionWidget } from "@/components/modules/CashPositionWidget";
import { UpcomingPayrollWidget } from "@/components/modules/UpcomingPayrollWidget";
import { AskVelaInsightWidget } from "@/components/modules/AskVelaInsightWidget";
import { OwnerDailyStatusBanner } from "@/components/modules/OwnerDailyStatusBanner";
import { GraduationPromptBanner } from "@/components/modules/GraduationPromptBanner";
import { EmailVerificationBanner } from "@/components/modules/EmailVerificationBanner";
import { useModuleVisibility } from "@/lib/business-profile/useModuleVisibility";

interface SetupChecklist {
  complianceObligationsSelected: boolean;
  bankAccountConnected: boolean;
  teamInvited: boolean;
}

// Design System 6.5/Part 7 — the first-run guided checklist replaces the hero
// slot until 4-of-4 complete. "Business created" is always done by the time
// this renders (signup is a prerequisite of reaching the dashboard); the
// other 3 are read from GET /v1/organisation/setup-checklist, computed on
// read from data that already exists elsewhere (compliance obligations, bank
// accounts, invites/staff) rather than a separate stored flag.
function FirstRunChecklist() {
  const {
    data: checklist,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["organisation", "setup-checklist"],
    queryFn: () => api.get<SetupChecklist>("/v1/organisation/setup-checklist"),
    staleTime: 30_000,
  });

  const steps = [
    { label: "Business created", done: true, href: null },
    {
      label: "Compliance obligations selected",
      done: checklist?.complianceObligationsSelected ?? false,
      href: "/compliance/settings",
    },
    {
      label: "Bank account connected",
      done: checklist?.bankAccountConnected ?? false,
      href: "/money",
    },
    { label: "Team invited", done: checklist?.teamInvited ?? false, href: "/settings/users" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  // Until the fetch resolves, every unread flag defaults to `false` — which
  // would render a confident "1 of 4, nothing done" that then pops as the
  // real answer arrives. Design System 4.17: show a skeleton of the final
  // shape rather than a plausible-looking wrong answer.
  if (isPending) {
    return (
      <Card accent className="md:col-span-2">
        <CardHeader>
          <CardTitle eyebrow>Get set up</CardTitle>
          <Skeleton className="h-4 w-8" />
        </CardHeader>
        <Skeleton className="rounded-pill mb-4 h-1 w-full" />
        <div className="divide-border flex flex-col divide-y">
          {steps.map((step) => (
            <div key={step.label} className="flex min-h-[44px] items-center gap-3">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <Skeleton className="h-3.5 w-[min(60%,220px)]" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Same reasoning as the skeleton above: a failed fetch must not render as
  // "nothing is set up". This is the one card an owner acts on during their
  // first week, so it gets a real way forward, not a dead red sentence.
  if (error) {
    return (
      <Card accent className="md:col-span-2">
        <CardHeader>
          <CardTitle eyebrow>Get set up</CardTitle>
        </CardHeader>
        <p className="font-ui text-text-secondary text-[0.875rem]">
          We couldn&apos;t check your setup progress just now.
        </p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  const allDone = doneCount === steps.length;

  return (
    <Card accent className="md:col-span-2">
      <CardHeader>
        <CardTitle eyebrow>Get set up</CardTitle>
        {/* The count is the card's one number — mono, tabular, right-aligned,
            the same ledger treatment every other figure in the product gets,
            rather than prose inside the eyebrow label. */}
        <span className="font-data text-text-secondary text-[0.75rem] font-bold tabular-nums">
          {doneCount}/{steps.length}
        </span>
      </CardHeader>
      {/* A gold rule that fills as you go — the same "gold rule under the
          heading" instrument the PageHeader established, here made to carry
          progress. Width is the only thing that animates. */}
      <div
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-label="Setup progress"
        className="bg-border rounded-pill mb-4 h-1 w-full overflow-hidden"
      >
        <div
          className="bg-gold duration-deliberate h-full transition-[width] motion-reduce:transition-none"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <ul className="divide-border flex flex-col divide-y">
        {steps.map((step) => {
          const icon = step.done ? (
            <CheckCircle2 className="text-sage size-4 shrink-0" aria-hidden />
          ) : (
            <Circle className="text-text-secondary size-4 shrink-0" aria-hidden />
          );
          // Done steps recede to secondary so the eye lands on what's left;
          // remaining steps keep primary weight and are the only rows that
          // are interactive.
          const body = (
            <>
              {icon}
              <span className="flex-1">{step.label}</span>
            </>
          );
          return (
            <li key={step.label} className="font-ui text-[0.875rem]">
              {step.href && !step.done ? (
                <Link
                  href={step.href}
                  // The whole row is the target, not the four words inside
                  // it: 44px tall, and the -mx-2/px-2 pair lets the hover
                  // wash bleed past the text without breaking the card's
                  // 16px padding grid.
                  className="text-text-primary hover:bg-surface-overlay duration-quick group -mx-2 flex min-h-[44px] items-center gap-3 rounded-sm px-2 transition-colors"
                >
                  {body}
                  <ChevronRight
                    className="text-text-secondary group-hover:text-text-primary duration-quick size-4 shrink-0 transition-colors"
                    aria-hidden
                  />
                </Link>
              ) : (
                <div className="text-text-secondary -mx-2 flex min-h-[44px] items-center gap-3 px-2">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {allDone ? (
        <p className="font-ui text-sage mt-3 text-[0.875rem] font-semibold">
          Setup complete — everything below is live.
        </p>
      ) : null}
    </Card>
  );
}

// Ledger-statement convention — "as of" date, uppercase, mono. Matches the
// header's eyebrow/rule treatment (see DashboardHomePage below).
function todayLabel(): string {
  return new Date()
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

export default function DashboardHomePage() {
  const { visibility } = useModuleVisibility();

  // Priority order per Design System 7.1 — Foundation has no live data yet, so
  // every slot below the checklist is an honest "not built yet" placeholder
  // rather than a fabricated number. Business profiling (Requirement 4) only
  // ever changes which of these DEFAULT onto the dashboard, never removes a
  // page/route — every widget's underlying page is still reachable directly.
  const widgetSlots: (DashboardWidgetSlot | false)[] = [
    { id: "first-run", span: 2, mobilePriority: 1, children: <FirstRunChecklist /> },
    visibility.compliance && {
      id: "compliance",
      span: 1,
      mobilePriority: 2,
      children: <ComplianceWidget />,
    },
    // Cash position (bank sync) isn't gated by any onboarding factor — it's
    // useful to every business regardless of formality or staffing.
    {
      id: "cash-position",
      span: 1,
      mobilePriority: 3,
      children: <CashPositionWidget />,
    },
    visibility.invoicing && {
      id: "invoices",
      span: 2,
      mobilePriority: 4,
      children: <OutstandingInvoicesWidget />,
    },
    visibility.payroll && {
      id: "payroll",
      span: 1,
      mobilePriority: 5,
      children: <UpcomingPayrollWidget />,
    },
    // Ask Vela is always visible — only its response mode changes with
    // Factor C (see business-profile.ts#computeAskVelaMode), wired
    // server-side in the conversation service, not here.
    {
      id: "ai-insight",
      span: 1,
      mobilePriority: 6,
      children: <AskVelaInsightWidget />,
    },
    visibility.inventoryReorder && {
      id: "low-stock",
      span: 1,
      mobilePriority: 7,
      children: <LowStockWidget />,
    },
  ];
  const widgets: DashboardWidgetSlot[] = widgetSlots.filter((w): w is DashboardWidgetSlot =>
    Boolean(w),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* The banners are one notification group, not three peers of the page's
          own sections — spaced 8px from each other and a full 32px from the
          header below, so proximity says "these belong together" instead of
          the flat gap-6 that made a stack of three read as page structure. */}
      <div className="flex flex-col gap-2 empty:hidden">
        <EmailVerificationBanner />
        <GraduationPromptBanner />
        {visibility.cashReconciliation ? <OwnerDailyStatusBanner /> : null}
      </div>
      <PageHeader
        eyebrow="Dashboard"
        title="Home"
        action={
          <p className="font-data text-text-secondary text-[0.78rem] tabular-nums">
            {todayLabel()}
          </p>
        }
      />
      <DashboardTemplate widgets={widgets} />
    </div>
  );
}
