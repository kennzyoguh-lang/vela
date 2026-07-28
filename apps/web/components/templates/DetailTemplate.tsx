import type { ReactNode } from "react";

// Design System 3.4 — header (identity + status + actions) + two-column body
// (main 8 col / meta rail 4 col; stacks on mobile).
export function DetailTemplate({
  header,
  main,
  rail,
}: {
  header: ReactNode;
  main: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">{main}</div>
        <div className="lg:col-span-4">{rail}</div>
      </div>
    </div>
  );
}
