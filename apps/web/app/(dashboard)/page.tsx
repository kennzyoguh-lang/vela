import { CheckCircle2, Circle, Landmark, ShieldCheck, Users, Sparkles } from "lucide-react";
import {
  DashboardTemplate,
  type DashboardWidgetSlot,
} from "@/components/templates/DashboardTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OutstandingInvoicesWidget } from "@/components/modules/OutstandingInvoicesWidget";

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

function PlaceholderWidget({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon: typeof Landmark;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Card className="flex h-full flex-col justify-between gap-4">
      <div>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <Icon className="text-text-secondary size-4" aria-hidden />
        </CardHeader>
        <p className="font-ui text-text-secondary text-[0.875rem]">{description}</p>
      </div>
      <Button variant="secondary" size="sm" disabled>
        {cta}
      </Button>
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
      children: (
        <PlaceholderWidget
          icon={ShieldCheck}
          title="Compliance"
          description="ComplianceRadar isn't built yet — this card will show your next filing deadline."
          cta="Coming soon"
        />
      ),
    },
    {
      id: "cash-position",
      span: 1,
      mobilePriority: 3,
      children: (
        <PlaceholderWidget
          icon={Landmark}
          title="Cash position"
          description="Connect a bank account once P&L Intelligence ships to see your balance here."
          cta="Coming soon"
        />
      ),
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
      children: (
        <PlaceholderWidget
          icon={Users}
          title="Upcoming payroll"
          description="PeopleHub isn't built yet — this card will show your next payroll run."
          cta="Coming soon"
        />
      ),
    },
    {
      id: "ai-insight",
      span: 1,
      mobilePriority: 6,
      children: (
        <PlaceholderWidget
          icon={Sparkles}
          title="Ask Vela insight"
          description="Ask Vela isn't connected yet — this card will surface one AI insight at a time."
          cta="Coming soon"
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-ui text-text-primary text-[1.5rem] font-bold">Home</h1>
      <DashboardTemplate widgets={widgets} />
    </div>
  );
}
