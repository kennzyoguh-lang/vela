"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"] as const;

interface NumberPadProps {
  digits: string;
  onChange: (digits: string) => void;
  currency: string;
  clearLabel: string;
}

// Whole-naira digit entry (tapping "5""0""0" builds ₦500) — traders count
// physical notes, not kobo, so there's no decimal point on this pad. Caps at
// 9 digits (under a billion) purely to keep the live display from overflowing
// its box; it's not a meaningful business limit.
export function NumberPad({ digits, onChange, currency, clearLabel }: NumberPadProps) {
  function press(key: (typeof KEYS)[number]) {
    if (key === "clear") return onChange("");
    if (key === "backspace") return onChange(digits.slice(0, -1));
    if (digits.length >= 9) return;
    if (key === "0" && digits === "") return; // no leading zero
    onChange(digits + key);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface-secondary rounded-2xl px-4 py-6 text-center">
        <span className="font-data text-text-primary text-[2.5rem] font-bold">
          {formatMoney(digits || "0", currency)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={
              key === "clear" ? clearLabel : key === "backspace" ? "Backspace" : undefined
            }
            className={cn(
              "font-data flex min-h-[64px] items-center justify-center rounded-2xl text-[1.5rem] font-bold",
              "bg-surface-secondary text-text-primary transition-transform active:scale-95",
              key === "clear" && "text-[0.9375rem]",
            )}
          >
            {key === "backspace" ? (
              <Delete className="size-6" aria-hidden />
            ) : key === "clear" ? (
              clearLabel
            ) : (
              key
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
