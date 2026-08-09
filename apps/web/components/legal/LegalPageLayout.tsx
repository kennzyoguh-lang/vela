import type { ReactNode } from "react";
import Link from "next/link";
import { VelaLogo } from "@/components/brand/VelaLogo";

// Shared wrapper for /terms and /privacy — same "no app shell, own layout"
// precedent as the other standalone public pages (app/pay/layout.tsx,
// app/firs-calculator/layout.tsx), but a plain readable prose column rather
// than a card, since this is one long document, not a form or a result.
export function LegalPageLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-surface-canvas min-h-dvh px-4 py-10 md:px-6">
      <div className="mx-auto flex max-w-[720px] flex-col gap-8">
        <Link href="/" className="flex justify-center">
          <div className="hidden dark:block">
            <VelaLogo variant="primary-dark" />
          </div>
          <div className="block dark:hidden">
            <VelaLogo variant="mono-dark" />
          </div>
        </Link>
        <div>
          <h1 className="font-display text-text-primary text-[1.9rem] font-normal">{title}</h1>
          <p className="font-data text-text-secondary mt-2 text-[0.72rem] uppercase tracking-[0.06em]">
            Last updated {updated}
          </p>
        </div>
        <div className="font-ui text-text-primary flex flex-col gap-5 text-[0.9rem] leading-[1.75]">
          {children}
        </div>
        <Link href="/" className="font-ui text-data-aiAccent text-[0.85rem] hover:underline">
          &larr; Back to VELA
        </Link>
      </div>
    </div>
  );
}
