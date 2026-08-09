import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Design System 4.8 — a card is one subject; a card listing unrelated things
// is three cards or a table, not this component's job to prevent.
//
// `accent` is opt-in, not the default — a gold top edge marks a card as a
// data/insight surface (dashboard KPI widgets), the same "ledger instrument"
// treatment as the brand's own marketing material. A settings form or a
// plain content card stays unaccented; not every card gets the gold edge.
export function Card({
  className,
  accent,
  ...props
}: HTMLAttributes<HTMLDivElement> & { accent?: boolean }) {
  return (
    <div
      className={cn(
        "border-border bg-surface-raised shadow-1 rounded-lg border p-4",
        accent && "border-t-gold border-t-2",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex items-center justify-between", className)} {...props} />;
}

// `eyebrow` renders the title as a small, letter-spaced, monospace label —
// the ledger convention for a card's subject line (mirrors a printed
// statement's column header) — instead of the default UI-weight heading.
// Opt-in for the same reason as Card's `accent`: most CardTitles (Settings,
// forms) should stay exactly as they read today.
export function CardTitle({
  className,
  eyebrow,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { eyebrow?: boolean }) {
  return (
    <h3
      className={cn(
        eyebrow
          ? "font-data text-text-secondary text-[0.68rem] font-bold uppercase tracking-[0.08em]"
          : "font-ui text-text-primary text-[1rem] font-semibold",
        className,
      )}
      {...props}
    />
  );
}
