import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--next-font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "VELA — Your business, fully understood.",
  description: "The Business Operating System for African SMEs.",
};

// Theme resolution runs before paint (inline script, no FOUC) — reads the
// persisted preference from ui-store's localStorage key, falling back to the
// system preference via the CSS media query in tokens.css when nothing is
// stored yet. Dark is the default identity mode (Design System 2.11).
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("vela-ui-preferences");
    var theme = stored ? JSON.parse(stored).state.theme : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Read back the per-request nonce middleware.ts attached to this request's
  // headers — required for this inline script to run under the CSP's
  // nonce-based script-src (a plain <script> with no nonce is blocked).
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
