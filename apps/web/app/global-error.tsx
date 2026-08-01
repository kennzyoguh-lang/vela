"use client";

import { useEffect } from "react";

// Catches a crash in the root layout itself (e.g. providers.tsx) — the one
// case app/error.tsx can't cover, since an error.tsx never catches errors
// thrown by its own parent layout. This replaces the ENTIRE document
// (Next.js requirement), so it can't rely on globals.css/Tailwind having
// loaded — plain inline styles only, deliberately minimal.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0B1220",
          color: "#F5F5F5",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>Something went wrong</p>
          <p style={{ fontSize: "0.875rem", opacity: 0.8, marginTop: "0.5rem" }}>
            VELA ran into a problem loading. Try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#D4AF37",
              color: "#0B1220",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
