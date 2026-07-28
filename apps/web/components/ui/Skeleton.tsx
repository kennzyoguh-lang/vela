import { cn } from "@/lib/utils";

// Design System 4.17 — skeletons mirror the final layout's shape exactly and
// appear within 100ms; shimmer disabled under reduced-motion (static block).
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700",
        "motion-reduce:animate-none",
        className,
      )}
      aria-hidden
    />
  );
}
