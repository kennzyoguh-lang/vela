import type { InvoiceStatus } from "@vela/types";
import type { BadgeStatus } from "@/components/ui/Badge";

// Design System 4.14's canonical status map reused for invoices — Badge stays
// generic/reusable across modules, this is the one place that translates.
const STATUS_TO_BADGE: Record<InvoiceStatus, BadgeStatus> = {
  draft: "draft",
  sent: "sent",
  viewed: "viewed",
  partially_paid: "partial",
  paid: "active",
  overdue: "overdue",
  written_off: "archived",
  void: "archived",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  written_off: "Written off",
  void: "Void",
};

export function invoiceBadgeStatus(status: InvoiceStatus): BadgeStatus {
  return STATUS_TO_BADGE[status];
}

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return STATUS_LABEL[status];
}

// Design System 4.25 — never a bare number, always the Low/Medium/High scale.
export function riskLabel(score: number | null): { label: string; className: string } {
  if (score === null) return { label: "Not scored", className: "text-text-secondary" };
  if (score > 66) return { label: "High risk", className: "text-rust" };
  if (score >= 34) return { label: "Medium risk", className: "text-gold-dark" };
  return { label: "Low risk", className: "text-sage" };
}
