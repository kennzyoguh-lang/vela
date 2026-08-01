"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

// POS's audience is semi-literate traders/staff (see pos/layout.tsx) — a
// crash here must never leave someone stuck on an unstyled Next.js error
// screen with no obvious way out. The logo header from pos/layout.tsx stays
// visible; only the content area is replaced.
export default function PosError({
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
