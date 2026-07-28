"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: ReactNode }) {
  // TanStack Query owns all server state (Handbook 4.5) — one client per
  // browser session, created once via useState so it survives re-renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // fast-changing-tier default (Handbook 4.10); pages override per data type
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
