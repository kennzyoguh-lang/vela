import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { ForceLightTheme } from "./ForceLightTheme";
import { VelaLogo } from "@/components/brand/VelaLogo";

// Mirrors app/pay/layout.tsx exactly — standalone public page, no app shell,
// light mode always. Reached via the quote's own portal link, not app
// navigation.
export default function QuotePortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ForceLightTheme />
      <div className="bg-surface-canvas min-h-dvh px-4 py-10">
        <div className="mx-auto flex max-w-[480px] flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <VelaLogo variant="mono-dark" />
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
