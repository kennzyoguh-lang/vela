"use client";

import { CheckCircle2, Circle } from "lucide-react";
import {
  DashboardTemplate,
  type DashboardWidgetSlot,
} from "@/components/templates/DashboardTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { OutstandingInvoicesWidget } from "@/components/modules/OutstandingInvoicesWidget";
import { LowStockWidget } from "@/components/modules/LowStockWidget";
import { ComplianceWidget } from "@/components/modules/ComplianceWidget";
import { CashPositionWidget } from "@/components/modules/CashPositionWidget";
import { UpcomingPayrollWidget } from "@/components/modules/UpcomingPayrollWidget";
import { AskVelaInsightWidget } from "@/components/modules/AskVelaInsightWidget";
import { OwnerDailyStatusBanner } from "@/components/modules/OwnerDailyStatusBanner";
import { GraduationPromptBanner } from "@/components/modules/GraduationPromptBanner";
import { useModuleVisibility } from "@/lib/business-profile/useModuleVisibility";

const ONBOARDING_STEPS = [
  { label: "Business created", done: true },
  { label: "Compliance obligations selected", done: false },
  { label: "Bank account connected", done: false },
  { label: "Team invited", done: false },
];

// Design System 6.5/Part 7 — the first-run guided checklist replaces the hero
// slot until 4-of-4 complete (not yet reachable in Foundation since none of
// the underlying modules exist to mark a step genuinely done beyond signup).
function FirstRunChecklist() {
  const doneCount = ONBOARDING_STEPS.filter((s) => s.done).length;
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>
          Get set up ({doneCount} of {ONBOARDING_STEPS.length})
        </CardTitle>
      </CardHeader>
      <ul className="flex flex-col gap-2">
        {ONBOARDING_STEPS.map((step) => (
          <li
            key={step.label}
            className="font-ui text-text-primary flex items-center gap-2 text-[0.875rem]"
          >
            {step.done ? (
              <CheckCircle2 className="text-sage size-4" aria-hidden />
            ) : (
              <Circle className="text-text-secondary size-4" aria-hidden />
            )}
            {step.label}
          </li>
        ))}
      </ul>
    </Card>
  );
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
      <GraduationPromptBanner />
      {visibility.cashReconciliation ? <OwnerDailyStatusBanner /> : null}
      <h1 className="font-ui text-text-primary text-[1.5rem] font-bold">Home</h1>
      <DashboardTemplate widgets={widgets} />
    </div>
  );
}
