"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"] as const;

interface NumberPadProps {
  digits: string;
  onChange: (digits: string) => void;
  clearLabel: string;
  currency?: string;
  // "currency" (default) — whole-naira amount entry, formatMoney display, no
  // leading zero. "pin" — masked dot display, leading zero allowed (a PIN
  // legitimately can start with 0), shorter default cap.
  mode?: "currency" | "pin";
  maxLength?: number;
}

// Whole-naira digit entry (tapping "5""0""0" builds ₦500) — traders count
// physical notes, not kobo, so there's no decimal point on this pad. Also
// doubles as the anti-theft Piece 4 discount-approval PIN pad (mode="pin")
// — same big-button grid, no separate component to keep in sync.
export function NumberPad({
  digits,
  onChange,
  clearLabel,
  currency = "NGN",
  mode = "currency",
  maxLength = mode === "pin" ? 6 : 9,
}: NumberPadProps) {
  function press(key: (typeof KEYS)[number]) {
    if (key === "clear") return onChange("");
    if (key === "backspace") return onChange(digits.slice(0, -1));
    if (digits.length >= maxLength) return;
    if (mode === "currency" && key === "0" && digits === "") return; // no leading zero
    onChange(digits + key);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface-secondary rounded-2xl px-4 py-6 text-center">
        <span className="font-data text-text-primary text-[2.5rem] font-bold tracking-widest">
          {mode === "pin" ? "•".repeat(digits.length) || "—" : formatMoney(digits || "0", currency)}
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
