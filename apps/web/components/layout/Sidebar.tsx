"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { VelaLogo, VelaMark } from "@/components/brand/VelaLogo";
import { useModuleVisibility } from "@/lib/business-profile/useModuleVisibility";

// Design System 3.2 — fixed 240px expanded / 64px icon rail, user-collapsible,
// state persisted. Always Midnight (neutral.900) in both themes — the sidebar
// is brand chrome, not part of the themeable content canvas (Design System
// 2.11's "dark chrome, choice of canvas").
export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const { visibility } = useModuleVisibility();
  // Requirement 4 — this only ever changes the DEFAULT rendering; nothing
  // here blocks direct navigation to a hidden module's URL.
  const visibleItems = NAV_ITEMS.filter((item) => !item.moduleKey || visibility[item.moduleKey]);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "bg-midnight duration-standard hidden shrink-0 flex-col text-white transition-[width] md:flex",
        sidebarCollapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-4">
        {sidebarCollapsed ? (
          <VelaMark variant="primary-dark" className="size-8" />
        ) : (
          <VelaLogo variant="primary-dark" />
        )}
      </div>
      <ul className="flex flex-1 flex-col gap-1 p-2">
        {visibleItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                // In the collapsed rail the icon is all that shows, so the
                // label carries the native tooltip — otherwise the rail is a
                // column of unexplained glyphs with no way to learn them.
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-md border-l-[3px] border-transparent",
                  "font-ui duration-quick text-[0.875rem] text-white/70 transition-colors",
                  "hover:bg-white/5 hover:text-white",
                  // Design System 9.3 grammar (2px ring, 2px offset), gold
                  // rather than Cobalt here only because this rail is always
                  // Midnight in both themes (Design System 2.11's "dark
                  // chrome") — Cobalt on Midnight measures 1.85:1, so the
                  // product-wide ring is effectively invisible on exactly the
                  // element a keyboard user tabs through first.
                  "focus-visible:outline-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                  active && "border-gold text-gold bg-white/5",
                  // The collapsed rail centres its icons instead of keeping
                  // them on the expanded rail's text indent.
                  sidebarCollapsed ? "justify-center px-0" : "px-3",
                )}
              >
                <item.icon className="size-5 shrink-0" aria-hidden />
                {/* Never unmounted: dropping the label entirely left the link
                    with no accessible name at all (the icon is aria-hidden),
                    so a screen reader read the whole collapsed rail as nine
                    unlabelled links. */}
                <span className={cn(sidebarCollapsed && "sr-only")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* A hairline separates the one control that changes the chrome from
          the nine above it that change the page — same reason the TopBar sits
          under its own border. */}
      <div className="border-t border-white/10 p-2">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!sidebarCollapsed}
          className="duration-quick focus-visible:outline-gold flex min-h-[44px] w-full items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="size-5" aria-hidden />
          ) : (
            <ChevronsLeft className="size-5" aria-hidden />
          )}
        </button>
      </div>
    </nav>
  );
}
