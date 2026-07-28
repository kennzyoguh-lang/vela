import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Design System 4.8 — a card is one subject; a card listing unrelated things
// is three cards or a table, not this component's job to prevent.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-border bg-surface-raised shadow-1 rounded-lg border p-4", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex items-center justify-between", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-ui text-text-primary text-[1rem] font-semibold", className)}
      {...props}
    />
  );
}
