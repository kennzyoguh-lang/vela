import type { FilingStatus } from "@vela/types";
import type { BadgeStatus } from "@/components/ui/Badge";

// Design System 4.14's canonical status map reused for compliance filings —
// Badge stays generic/reusable across modules, this is the one place that
// translates (same approach as lib/invoice-status.ts).
const STATUS_TO_BADGE: Record<FilingStatus, BadgeStatus> = {
  upcoming: "draft",
  due_soon: "partial",
  overdue: "overdue",
  filed: "active",
};

const STATUS_LABEL: Record<FilingStatus, string> = {
  upcoming: "Upcoming",
  due_soon: "Due soon",
  overdue: "Overdue",
  filed: "Filed",
};

export function filingBadgeStatus(status: FilingStatus): BadgeStatus {
  return STATUS_TO_BADGE[status];
}

export function filingStatusLabel(status: FilingStatus): string {
  return STATUS_LABEL[status];
}

// Mirrors lib/format.ts's formatDuePhrase, adapted for filing status.
export function formatFilingDuePhrase(dueDate: string, status: FilingStatus): string {
  if (status === "filed") return "Filed";

  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  const overdueDays = Math.abs(days);
  return `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`;
}
