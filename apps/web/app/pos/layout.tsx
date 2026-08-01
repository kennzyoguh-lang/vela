import type { ReactNode } from "react";
import { ForceDarkTheme } from "./ForceDarkTheme";
import { PosRoleGate } from "./PosRoleGate";
import { VelaLogo } from "@/components/brand/VelaLogo";
import { OfflineQueueBanner } from "@/components/pos/OfflineQueueBanner";

// Anti-theft/POS staff area — full-bleed, no sidebar/topbar, own phone+PIN
// login (/pos/login) separate from the owner/admin email+password login.
// Practically a separate portal from the trader's perspective; lives in the
// same Next.js app rather than a separate deployment (no new infra to
// stand up or maintain, same reasoning as apps/web/app/pay).
export default function PosLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ForceDarkTheme />
      <PosRoleGate />
      <div className="bg-surface-canvas flex min-h-dvh flex-col">
        <header className="flex justify-center px-4 py-6">
          <VelaLogo variant="primary-dark" />
        </header>
        <main className="flex flex-1 flex-col gap-4 px-4 pb-8">
          <OfflineQueueBanner />
          {children}
        </main>
      </div>
    </>
  );
}
