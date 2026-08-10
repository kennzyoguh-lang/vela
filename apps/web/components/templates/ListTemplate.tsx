import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

// Design System 3.4 — header (title + primary action + search/filter bar) +
// table/card-list + pagination. Module pages (Invoices, Transactions,
// Employees, ...) compose this; Foundation ships the frame only. `eyebrow`
// defaults to the title itself (most list pages don't need a distinct
// section label above their own name) but can be overridden — e.g. "People"
// as the eyebrow above a "Payroll" title.
export function ListTemplate({
  title,
  eyebrow,
  primaryAction,
  filters,
  children,
}: {
  title: string;
  eyebrow?: string;
  primaryAction?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={eyebrow ?? title} title={title} action={primaryAction} />
      {filters ? <div className="flex flex-wrap gap-2">{filters}</div> : null}
      <div>{children}</div>
    </div>
  );
}
