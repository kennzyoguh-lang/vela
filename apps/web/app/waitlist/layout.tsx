import type { ReactNode } from "react";
import type { Metadata } from "next";
import { VelaLogo } from "@/components/brand/VelaLogo";

// GTM Channel 2 — standalone public marketing page, same layout precedent
// as app/firs-calculator/layout.tsx.
export const metadata: Metadata = {
  title: "Join the VELA Waitlist — The Business Operating System for African SMEs",
  description:
    "Get early access to VELA: invoicing, cash reconciliation, compliance tracking, and payroll built for Nigerian SMEs and traders.",
};

export default function WaitlistLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-canvas min-h-dvh px-4 py-10">
      <div className="mx-auto flex max-w-[480px] flex-col gap-6">
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
