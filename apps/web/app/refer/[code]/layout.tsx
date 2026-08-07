import type { ReactNode } from "react";
import type { Metadata } from "next";
import { VelaLogo } from "@/components/brand/VelaLogo";

// GTM Channel 3 — standalone public landing page, same layout precedent as
// app/waitlist/layout.tsx.
export const metadata: Metadata = {
  title: "You've been invited to VELA",
  description: "Join VELA — the Business Operating System for African SMEs.",
};

export default function ReferLayout({ children }: { children: ReactNode }) {
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
