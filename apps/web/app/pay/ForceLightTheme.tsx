"use client";

import { useLayoutEffect } from "react";

// Design System 6.13/2.11 — the payment portal is a standalone, external-facing
// page that never follows the visitor's dark-mode preference.
export function ForceLightTheme() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);
  return null;
}
