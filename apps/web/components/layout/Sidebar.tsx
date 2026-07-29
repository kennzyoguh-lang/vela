"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { VelaLogo, VelaMark } from "@/components/brand/VelaLogo";

// Design System 3.2 — fixed 240px expanded / 64px icon rail, user-collapsible,
// state persisted. Always Midnight (neutral.900) in both themes — the sidebar
// is brand chrome, not part of the themeable content canvas (Design System
// 2.11's "dark chrome, choice of canvas").
export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

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
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-md border-l-[3px] border-transparent px-3",
                  "font-ui text-[0.875rem] text-white/70 hover:bg-white/5 hover:text-white",
                  active && "border-gold text-gold bg-white/5",
                )}
              >
                <item.icon className="size-5 shrink-0" aria-hidden />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="m-2 flex min-h-[44px] items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
      >
        {sidebarCollapsed ? (
          <ChevronsRight className="size-5" aria-hidden />
        ) : (
          <ChevronsLeft className="size-5" aria-hidden />
        )}
      </button>
    </nav>
  );
}
