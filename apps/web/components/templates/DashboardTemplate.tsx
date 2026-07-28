import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Design System 3.4/6.5/Part 7 — widget grid mechanics only. Foundation builds
// the grid + first-run state; the widgets themselves (cash position,
// compliance, etc.) are empty-state stubs until their owning modules ship.
// `span` is the widget's desktop column span (1-4, of a 4-col grid);
// `mobilePriority` orders the same widgets on a single mobile column
// (Design System 7.1's mobile priority order is the literal source for this
// prop's values once real widgets replace the placeholders below).
export interface DashboardWidgetSlot {
  id: string;
  span: 1 | 2 | 3 | 4;
  mobilePriority: number;
  children: ReactNode;
}

export function DashboardTemplate({ widgets }: { widgets: DashboardWidgetSlot[] }) {
  const sorted = [...widgets].sort((a, b) => a.mobilePriority - b.mobilePriority);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {sorted.map((widget) => (
        <div
          key={widget.id}
          style={{ order: widget.mobilePriority }}
          className={cn(
            "md:order-none",
            widget.span === 1 && "md:col-span-1",
            widget.span === 2 && "md:col-span-2",
            widget.span === 3 && "md:col-span-3",
            widget.span === 4 && "md:col-span-4",
          )}
        >
          {widget.children}
        </div>
      ))}
    </div>
  );
}
