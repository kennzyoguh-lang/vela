import { cn } from "@/lib/utils";

// Design System 4.14 — canonical, product-wide status map. Never colour-only:
// label is always present alongside the colour.
export type BadgeStatus =
  "draft" | "sent" | "viewed" | "active" | "partial" | "overdue" | "archived";

const STATUS_STYLES: Record<BadgeStatus, string> = {
  draft: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  sent: "bg-cobalt/20 text-cobalt",
  viewed: "bg-cobalt/20 text-cobalt",
  active: "bg-sage/20 text-sage",
  partial: "bg-gold/20 text-gold-dark",
  overdue: "bg-rust/20 text-rust",
  archived: "bg-neutral-300/40 text-neutral-500",
};

export function Badge({ status, label }: { status: BadgeStatus; label: string }) {
  return (
    <span
      className={cn(
        "rounded-pill font-ui inline-flex h-6 items-center gap-1 px-2 text-[0.75rem] font-semibold",
        STATUS_STYLES[status],
      )}
    >
      <span className="size-2 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
