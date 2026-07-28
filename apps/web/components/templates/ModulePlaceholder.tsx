import type { LucideIcon } from "lucide-react";

// Design System 4.18 first-use empty state, generalized for whole modules that
// don't exist yet in Foundation. Real per-module empty states are individually
// designed when each module ships (Design System 4.18's own rule) — this is
// deliberately the generic placeholder Foundation is allowed to use in the
// meantime, not a template for what those first-use states should look like.
export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <Icon className="text-text-secondary size-10" aria-hidden />
      <h1 className="font-ui text-text-primary text-[1.25rem] font-semibold">{title}</h1>
      <p className="font-ui text-text-secondary max-w-[420px] text-[0.875rem]">{description}</p>
    </div>
  );
}
