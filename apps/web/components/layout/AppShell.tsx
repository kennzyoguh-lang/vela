import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomTabBar } from "./BottomTabBar";
import { AskVelaDock } from "./AskVelaDock";

// Design System 3.2 — the app shell layout contract every (dashboard) route
// renders inside. Structural responsive transformations only (3.7): sidebar
// <-> icon-rail <-> bottom-tabs; nothing else changes shape at breakpoints.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main-content" className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
      <AskVelaDock />
      <BottomTabBar />
    </div>
  );
}
