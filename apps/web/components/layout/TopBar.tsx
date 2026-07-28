"use client";

import { Search, Bell } from "lucide-react";

// Design System 3.2 — 56px, surface.raised, bottom border. Search/notifications
// are UI-complete shells wired to no data yet (Epic 8 scope); the command
// palette and notification center's real content arrive with their owning
// modules. Org switcher/profile menu are stubbed the same way.
export function TopBar() {
  return (
    <header className="border-border bg-surface-raised flex h-14 shrink-0 items-center justify-between border-b px-4">
      <button
        type="button"
        className="text-text-secondary hover:bg-surface-canvas flex min-h-[44px] items-center gap-2 rounded-md px-3"
        aria-label="Open search"
      >
        <Search className="size-4" aria-hidden />
        <span className="font-ui hidden text-[0.875rem] sm:inline">Search…</span>
        <kbd className="border-border font-data hidden rounded border px-1.5 text-[0.75rem] sm:inline">
          /
        </kbd>
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="text-text-secondary hover:bg-surface-canvas flex size-11 items-center justify-center rounded-md"
        >
          <Bell className="size-5" aria-hidden />
        </button>
        <div
          className="bg-cobalt font-ui flex size-9 items-center justify-center rounded-full text-[0.75rem] font-semibold text-white"
          aria-label="Account menu"
          role="img"
        >
          V
        </div>
      </div>
    </header>
  );
}
