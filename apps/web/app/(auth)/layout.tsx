// Design System 6.4 — Flow template, centered 400px card, no split-screen
// marketing panel: auth is a task, not a pitch.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-canvas flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <span className="font-ui text-text-primary text-[1.5rem] font-bold tracking-[0.18em]">
            VELA
          </span>
        </div>
        <div className="border-border bg-surface-raised shadow-1 rounded-lg border p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
