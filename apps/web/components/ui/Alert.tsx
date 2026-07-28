import type { ReactNode } from "react";
import { Info, TriangleAlert, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Design System 4.11 — one alert per context max; stacked banners mean the
// page has an information-architecture problem, not an alert shortage.
export type AlertVariant = "info" | "warning" | "danger";

const VARIANT_STYLES: Record<AlertVariant, { classes: string; Icon: typeof Info }> = {
  info: { classes: "bg-cobalt/10 border-cobalt/30 text-cobalt", Icon: Info },
  warning: { classes: "bg-gold/10 border-gold/30 text-gold-dark", Icon: TriangleAlert },
  danger: { classes: "bg-rust/10 border-rust/30 text-rust", Icon: OctagonAlert },
};

export function Alert({
  variant,
  title,
  children,
}: {
  variant: AlertVariant;
  title: string;
  children?: ReactNode;
}) {
  const { classes, Icon } = VARIANT_STYLES[variant];
  return (
    <div role="alert" className={cn("flex gap-3 rounded-md border px-4 py-3", classes)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-ui text-[0.875rem] font-semibold">{title}</p>
        {children ? <p className="font-ui text-[0.875rem]">{children}</p> : null}
      </div>
    </div>
  );
}
