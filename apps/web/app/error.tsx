"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

// Root-segment error boundary — catches any uncaught render/query exception
// not already caught by a more specific error.tsx closer to the route
// (e.g. (dashboard)/error.tsx). Without this, Next falls back to its own
// unstyled crash screen with no way back into the app.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-surface-canvas flex min-h-dvh flex-col">
      <ErrorState onRetry={reset} />
    </div>
  );
}
