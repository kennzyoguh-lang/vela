import type { ReactNode } from "react";

// Design System 3.4 — header (title + primary action + search/filter bar) +
// table/card-list + pagination. Module pages (Invoices, Transactions,
// Employees, ...) compose this; Foundation ships the frame only.
export function ListTemplate({
  title,
  primaryAction,
  filters,
  children,
}: {
  title: string;
  primaryAction?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-ui text-text-primary text-[1.5rem] font-bold">{title}</h1>
        {primaryAction}
      </div>
      {filters ? <div className="flex flex-wrap gap-2">{filters}</div> : null}
      <div>{children}</div>
    </div>
  );
}
