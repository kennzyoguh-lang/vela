import { VelaLogo } from "@/components/brand/VelaLogo";

// Design System 6.4 — Flow template, centered 400px card, no split-screen
// marketing panel: auth is a task, not a pitch.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-canvas flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <VelaLogo variant="primary-dark" showTagline />
        </div>
        <div className="border-border bg-surface-raised shadow-1 rounded-lg border p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
