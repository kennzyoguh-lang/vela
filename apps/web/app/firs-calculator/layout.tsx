import type { ReactNode } from "react";
import type { Metadata } from "next";
import { VelaLogo } from "@/components/brand/VelaLogo";

// GTM Channel 1 — standalone public marketing page, same "no app shell, own
// layout" precedent as app/pay/layout.tsx, but wider (640px, not 480px)
// since this carries a form + results table rather than a single card.
export const metadata: Metadata = {
  title: "FIRS Penalty Calculator — Estimate Your VAT, WHT & CIT Penalties | VELA",
  description:
    "Free calculator: estimate FIRS penalties for late VAT, Withholding Tax, and Companies Income Tax filings under Nigeria's 2025 tax reform. Not tax advice — a starting point for a conversation with FIRS or your accountant.",
};

export default function FirsCalculatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-canvas min-h-dvh px-4 py-10">
      <div className="mx-auto flex max-w-[640px] flex-col gap-6">
        <div className="flex justify-center">
          <div className="hidden dark:block">
            <VelaLogo variant="primary-dark" showTagline />
          </div>
          <div className="block dark:hidden">
            <VelaLogo variant="mono-dark" showTagline />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
