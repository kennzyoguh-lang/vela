"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

// Renders inside AppShell's <main> — Sidebar/TopBar/BottomTabBar stay put
// (they live in (dashboard)/layout.tsx, a parent this boundary can't
// replace), so a page-level crash doesn't strand the owner with no
// navigation back to a working page.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState onRetry={reset} />;
}
