"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";
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
      // border-white/10, not border-border: this bar is always Midnight brand
      // chrome (Design System 2.11), so it takes the same hairline the Sidebar
      // uses rather than the themeable content-canvas border token, which
      // drew a pale line across the bar's top edge in light theme.
      className="bg-midnight fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-white/10 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabItems.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "font-ui duration-quick focus-visible:outline-gold relative flex min-w-0 flex-1 flex-col",
              "items-center justify-center gap-1 px-1 text-[0.75rem] leading-none transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 active:bg-white/5",
              active ? "text-gold" : "text-white/60",
            )}
          >
            {/* Design System 4.14's rule — never colour alone — applies to
                "which tab am I on" as much as to a status badge. This is the
                Sidebar's gold left edge rotated onto the bar's top edge, so
                both navs mark the current destination the same way. */}
            <span
              className={cn(
                "bg-gold absolute inset-x-0 top-0 h-0.5",
                active ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
            <item.icon className="size-5 shrink-0" aria-hidden />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
