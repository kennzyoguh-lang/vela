"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_QUANTITIES = [1, 2, 3, 5, 10];

interface QuantityStepperProps {
  quantity: number;
  onChange: (quantity: number) => void;
  label: string;
}

// The chips are load-bearing, not decorative: a plain +/- stepper alone
// means selecting quantity 10 takes 10 taps (product + 9 presses of "+"),
// breaking the 3-tap ceiling for the core sale-logging loop. Any quick
// quantity reaches the same 2-tap total as the default quantity-of-1 path
// (tap product, tap chip); the +/- stepper stays available underneath for
// anything the chips don't cover.
export function QuantityStepper({ quantity, onChange, label }: QuantityStepperProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-ui text-text-secondary text-center text-[0.875rem] font-semibold">
        {label}
      </p>
      <div className="flex justify-center gap-2">
        {QUICK_QUANTITIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            aria-pressed={quantity === q}
            className={cn(
              "font-data flex size-12 items-center justify-center rounded-full text-[1.125rem] font-bold",
              quantity === q ? "bg-gold text-midnight" : "bg-surface-secondary text-text-primary",
            )}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, quantity - 1))}
          aria-label="Decrease quantity"
          className="bg-surface-secondary text-text-primary flex size-14 items-center justify-center rounded-full active:scale-95"
        >
          <Minus className="size-6" aria-hidden />
        </button>
        <span className="font-data text-text-primary min-w-[3ch] text-center text-[2rem] font-bold">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => onChange(quantity + 1)}
          aria-label="Increase quantity"
          className="bg-surface-secondary text-text-primary flex size-14 items-center justify-center rounded-full active:scale-95"
        >
          <Plus className="size-6" aria-hidden />
        </button>
      </div>
    </div>
  );
}
