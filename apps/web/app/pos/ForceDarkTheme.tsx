"use client";

import { useLayoutEffect } from "react";

// The POS staff area is a fixed, high-contrast surface — same "never follow
// the visitor's theme preference" reasoning as the payment portal's
// ForceLightTheme, just the opposite direction: Midnight is this app's own
// brand chrome color (sidebar, headers), and dark background + light text
// reads reliably in bright, outdoor market-stall conditions.
export function ForceDarkTheme() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);
  return null;
}
