"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Design System 4.1 (extends Handbook 3.1). Label is always a verb phrase
// ("Send invoice", not "Invoice") — enforced in code review, not by this
// component, since it's a copy convention rather than something typeable here.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-ui font-semibold " +
    "transition-transform duration-quick active:scale-[0.98] disabled:opacity-40 " +
    "disabled:pointer-events-none min-h-[44px]",
  {
    variants: {
      variant: {
        primary: "bg-action-primary text-action-primaryText hover:brightness-95",
        secondary:
          "bg-surface-secondary border border-border text-text-primary hover:bg-surface-raised",
        destructive: "bg-status-danger text-white hover:brightness-95",
        ghost: "bg-transparent text-text-primary hover:bg-surface-raised",
      },
      size: {
        sm: "h-8 px-3 text-[0.875rem]",
        md: "h-10 px-4 text-[1rem]",
        lg: "h-12 px-6 text-[1.125rem]",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
