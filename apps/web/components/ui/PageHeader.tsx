import type { ReactNode } from "react";

// The ledger-statement page header — a small gold mono eyebrow, a serif
// display title, and a short gold rule underneath. Established on Dashboard
// Home; every module page reuses this instead of a plain <h1> so the whole
// app reads as one consistent instrument, not a page-by-page patchwork.
// `action` is a right-aligned slot for whatever a given page needs there —
// a date, a primary button, a status pill.
export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="font-data text-gold mb-2 text-[0.7rem] font-bold uppercase tracking-[0.14em]">
          {eyebrow}
        </p>
        <h1 className="font-display text-text-primary text-[2rem] font-normal leading-tight">
          {title}
        </h1>
        <div className="bg-gold mt-3 h-0.5 w-14" aria-hidden />
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
