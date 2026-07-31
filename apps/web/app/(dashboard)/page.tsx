import { CheckCircle2, Circle } from "lucide-react";
import {
  DashboardTemplate,
  type DashboardWidgetSlot,
} from "@/components/templates/DashboardTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { OutstandingInvoicesWidget } from "@/components/modules/OutstandingInvoicesWidget";
import { ComplianceWidget } from "@/components/modules/ComplianceWidget";
import { CashPositionWidget } from "@/components/modules/CashPositionWidget";
import { UpcomingPayrollWidget } from "@/components/modules/UpcomingPayrollWidget";
import { AskVelaInsightWidget } from "@/components/modules/AskVelaInsightWidget";
import { OwnerDailyStatusBanner } from "@/components/modules/OwnerDailyStatusBanner";

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
  // Priority order per Design System 7.1 — Foundation has no live data yet, so
  // every slot below the checklist is an honest "not built yet" placeholder
  // rather than a fabricated number.
  const widgets: DashboardWidgetSlot[] = [
    { id: "first-run", span: 2, mobilePriority: 1, children: <FirstRunChecklist /> },
    {
      id: "compliance",
      span: 1,
      mobilePriority: 2,
      children: <ComplianceWidget />,
    },
    {
      id: "cash-position",
      span: 1,
      mobilePriority: 3,
      children: <CashPositionWidget />,
    },
    {
      id: "invoices",
      span: 2,
      mobilePriority: 4,
      children: <OutstandingInvoicesWidget />,
    },
    {
      id: "payroll",
      span: 1,
      mobilePriority: 5,
      children: <UpcomingPayrollWidget />,
    },
    {
      id: "ai-insight",
      span: 1,
      mobilePriority: 6,
      children: <AskVelaInsightWidget />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <OwnerDailyStatusBanner />
      <h1 className="font-ui text-text-primary text-[1.5rem] font-bold">Home</h1>
      <DashboardTemplate widgets={widgets} />
    </div>
  );
}
