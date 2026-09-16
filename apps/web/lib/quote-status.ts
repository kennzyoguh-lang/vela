import type { QuoteStatus } from "@vela/types";
import type { BadgeStatus } from "@/components/ui/Badge";

// Design System 4.14's canonical status map, reused for quotes exactly like
// invoice-status.ts does for invoices — Badge stays generic/reusable across
// modules, this is the one place that translates.
const STATUS_TO_BADGE: Record<QuoteStatus, BadgeStatus> = {
  draft: "draft",
  sent: "sent",
  accepted: "active",
  declined: "overdue",
  expired: "archived",
};

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

export function quoteBadgeStatus(status: QuoteStatus): BadgeStatus {
  return STATUS_TO_BADGE[status];
}

export function quoteStatusLabel(status: QuoteStatus): string {
  return STATUS_LABEL[status];
}

// Mirrors lib/format.ts's formatDuePhrase, retyped for QuoteStatus's own
// terminal states (accepted/declined/expired) rather than Invoice's
// (paid/void/written_off) — a quote's "due" framing is "valid until", not
// "due on".
export function formatValidUntilPhrase(validUntil: string, status: QuoteStatus): string {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "expired") return "Expired";

  const validTo = new Date(validUntil);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  validTo.setHours(0, 0, 0, 0);
  const days = Math.round((validTo.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (days === 0) return "Valid until today";
  if (days > 0) return `Valid for ${days} more day${days === 1 ? "" : "s"}`;
  const expiredDays = Math.abs(days);
  return `Expired ${expiredDays} day${expiredDays === 1 ? "" : "s"} ago`;
}
