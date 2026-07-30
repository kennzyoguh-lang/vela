import { VelaLogo } from "@/components/brand/VelaLogo";

// Design System 6.4 — Flow template, centered 400px card, no split-screen
// marketing panel: auth is a task, not a pitch.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-canvas flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        {/* Vela Logo Identity System v1.0 §07: "never place on low-contrast
            background" — bg-surface-canvas flips between Midnight (dark
            theme) and near-white (light theme), so primary-dark's white
            wordmark (correct on Midnight) would be unreadable in light mode.
            Both variants render; only the one matching the live theme shows. */}
        <div className="mb-8 flex justify-center">
          <div className="hidden dark:block">
            <VelaLogo variant="primary-dark" showTagline />
          </div>
          <div className="block dark:hidden">
            <VelaLogo variant="mono-dark" showTagline />
          </div>
        </div>
        <div className="border-border bg-surface-raised shadow-1 rounded-lg border p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
