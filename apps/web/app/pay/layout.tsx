import type { ReactNode } from "react";
import { ForceLightTheme } from "./ForceLightTheme";
import { VelaLogo } from "@/components/brand/VelaLogo";

// Design System 6.13 — standalone public page, no app shell, no sidebar/topbar,
// light mode always. Reached via the invoice's Pay Now link, not app navigation.
// This is arguably the single most externally-visible surface in the product
// — an SME's own customers land here to pay — so it gets the mark even
// though nothing else on the page is app-navigation chrome.
export default function PayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ForceLightTheme />
      <div className="bg-surface-canvas min-h-dvh px-4 py-10">
        <div className="mx-auto flex max-w-[480px] flex-col gap-6">
          <div className="flex justify-center">
            <VelaLogo variant="mono-dark" />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
