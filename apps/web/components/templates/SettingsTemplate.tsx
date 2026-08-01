import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  { label: "Organisation", href: "/settings" },
  { label: "Users", href: "/settings/users" },
  { label: "Products", href: "/settings/products" },
  { label: "Modules", href: "/settings/modules" },
  { label: "Accountants", href: "/settings/accountants" },
  { label: "Security", href: "/settings/security" },
] as const;

// Design System 3.4 — left settings-nav (200px; collapses to a dropdown on
// mobile, simplified to a horizontal scroll list here for Foundation) + form
// sections.
export function SettingsTemplate({
  activePath,
  children,
}: {
  activePath: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <nav aria-label="Settings" className="flex gap-2 overflow-x-auto md:w-[200px] md:flex-col">
        {SETTINGS_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activePath === item.href ? "page" : undefined}
            className={cn(
              "font-ui flex min-h-[44px] items-center whitespace-nowrap rounded-md px-3 py-2 text-[0.875rem]",
              activePath === item.href
                ? "bg-surface-raised text-text-primary font-semibold"
                : "text-text-secondary hover:bg-surface-raised",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
