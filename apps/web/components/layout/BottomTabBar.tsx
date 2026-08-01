"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";
import { useModuleVisibility } from "@/lib/business-profile/useModuleVisibility";

// Design System 3.2 — mobile bottom tab bar, 64px height + safe-area inset,
// five destinations max (the 5-tab ergonomic ceiling, Handbook 3.6).
export function BottomTabBar() {
  const pathname = usePathname();
  const { visibility } = useModuleVisibility();
  const tabItems = NAV_ITEMS.filter(
    (item) => item.mobilePrimary && (!item.moduleKey || visibility[item.moduleKey]),
  );

  return (
    <nav
      aria-label="Primary"
      className="border-border bg-midnight fixed inset-x-0 bottom-0 z-30 flex h-16 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "font-ui flex flex-1 flex-col items-center justify-center gap-1 text-[0.75rem]",
              active ? "text-gold" : "text-white/60",
            )}
          >
            <item.icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
