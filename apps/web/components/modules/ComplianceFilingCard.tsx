import Link from "next/link";
import type { ComplianceFiling, ComplianceObligation } from "@vela/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  filingBadgeStatus,
  filingStatusLabel,
  formatFilingDuePhrase,
} from "@/lib/compliance-status";

// Mirrors InvoiceCard.tsx's shape (Design System 4.25) — obligation label +
// authority, period, due phrase, status badge. One filing per card.
export function ComplianceFilingCard({
  filing,
  obligation,
}: {
  filing: ComplianceFiling;
  obligation: ComplianceObligation;
}) {
  return (
    <Link href={`/compliance/${filing.id}`}>
      <Card className="hover:border-data-aiAccent flex items-center justify-between gap-4 transition-colors">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-ui text-text-primary truncate text-[0.875rem] font-semibold">
              {obligation.label}
            </p>
            <Badge
              status={filingBadgeStatus(filing.status)}
              label={filingStatusLabel(filing.status)}
            />
          </div>
          <p className="text-text-secondary mt-1 font-mono text-[0.75rem]">
            {obligation.authority} · {filing.periodLabel} ·{" "}
            {formatFilingDuePhrase(filing.dueDate, filing.status)}
          </p>
        </div>
      </Card>
    </Link>
  );
}
