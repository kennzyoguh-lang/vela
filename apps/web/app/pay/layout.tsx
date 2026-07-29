import type { ReactNode } from "react";
import { ForceLightTheme } from "./ForceLightTheme";

// Design System 6.13 — standalone public page, no app shell, no sidebar/topbar,
// light mode always. Reached via the invoice's Pay Now link, not app navigation.
export default function PayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ForceLightTheme />
      <div className="bg-surface-base min-h-dvh px-4 py-10">
        <div className="mx-auto flex max-w-[480px] flex-col gap-6">{children}</div>
      </div>
    </>
  );
}
