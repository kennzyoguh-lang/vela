"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "#modules", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "#africa", label: "Built for Africa" },
];

// Marketing nav collapses to this below `sm` — the desktop header just
// hides #modules/#pricing/#africa at that width with nothing to reach them
// otherwise, which silently drops most of the nav for mobile visitors.
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="text-text-primary flex size-9 items-center justify-center"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      {open ? (
        <div className="border-border bg-surface-raised absolute inset-x-0 top-16 z-30 border-b px-4 py-4 shadow-lg">
          <nav className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="font-ui text-text-primary hover:bg-surface-secondary rounded-sm px-2 py-3 text-[0.95rem] font-bold"
              >
                {link.label}
              </a>
            ))}
            <div className="border-border mt-2 flex flex-col gap-2 border-t pt-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="font-ui text-text-primary hover:bg-surface-secondary rounded-sm px-2 py-3 text-[0.95rem] font-bold"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="bg-action-primary text-action-primaryText font-ui inline-flex h-11 items-center justify-center rounded-sm px-4 text-[0.9rem] font-bold"
              >
                Start free
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
