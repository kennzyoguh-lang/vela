"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

// Design System 4.2 (extends Handbook 3.2). Every input has a visible <label>,
// never placeholder-as-label; error messages are programmatically associated
// via aria-describedby and APPEND to helper text rather than replacing it.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, required, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={inputId}
          className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]"
        >
          {label}
          {required ? (
            <span aria-hidden className="text-status-danger">
              {" "}
              *
            </span>
          ) : null}
        </label>
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-required={required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={cn(helperText && helperId, error && errorId) || undefined}
          className={cn(
            "border-border bg-surface-raised font-ui text-text-primary h-10 rounded-sm border px-3",
            "focus:border-data-aiAccent",
            error && "border-status-danger",
            className,
          )}
          {...props}
        />
        {helperText ? (
          <p id={helperId} className="text-text-secondary text-[0.75rem]">
            {helperText}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-status-danger text-[0.75rem]">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
