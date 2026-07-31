"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmSaleButtonProps {
  label: string;
  loadingLabel: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

// The single, always-visible CTA for the sale-logging loop — deliberately
// its own oversized component rather than the shared Button at size="lg",
// same reasoning as ProductTile: POS touch targets are a distinct scale
// from the rest of the dashboard.
export function ConfirmSaleButton({
  label,
  loadingLabel,
  loading,
  disabled,
  onClick,
}: ConfirmSaleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "font-ui flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl text-[1.5rem] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-40",
        "bg-sage",
      )}
    >
      {loading ? <Loader2 className="size-7 animate-spin" aria-hidden /> : null}
      {loading ? loadingLabel : label}
    </button>
  );
}
