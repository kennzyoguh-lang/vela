"use client";

import { useLayoutEffect } from "react";

// Mirrors app/pay/ForceLightTheme.tsx — the quote portal is the same kind of
// standalone, external-facing page that never follows the visitor's
// dark-mode preference.
export function ForceLightTheme() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);
  return null;
}
