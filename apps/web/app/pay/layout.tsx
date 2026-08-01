import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
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
          <div className="flex flex-col items-center gap-2">
            <VelaLogo variant="mono-dark" />
            {/* A first-time customer paying an unfamiliar business via a link
                or QR code is the exact moment trust signals matter most —
                this line exists purely for that reassurance. */}
            <div className="text-text-secondary flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" aria-hidden />
              <span className="font-ui text-[0.75rem] font-semibold tracking-[0.02em]">
                Secured by Vela
              </span>
            </div>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
