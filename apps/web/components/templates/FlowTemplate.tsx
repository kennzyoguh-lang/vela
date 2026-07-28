import type { ReactNode } from "react";

// Design System 3.4/3.6 — focused single column, max 640px, stepper header,
// one action per step. Used by onboarding, payroll run, bank connect, 2FA setup.
export function FlowTemplate({
  step,
  totalSteps,
  title,
  children,
  footer,
  maxWidthClassName = "max-w-[640px]",
}: {
  step: number;
  totalSteps: number;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  maxWidthClassName?: string;
}) {
  return (
    <div className={`mx-auto flex w-full flex-col gap-6 ${maxWidthClassName}`}>
      <div>
        <p className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]">
          Step {step} of {totalSteps}
        </p>
        <h1 className="font-ui text-text-primary text-[1.25rem] font-semibold">{title}</h1>
      </div>
      <div>{children}</div>
      <div className="flex justify-end gap-2">{footer}</div>
    </div>
  );
}
