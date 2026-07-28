import { Sparkles } from "lucide-react";

// Design System 3.2/6.10/8.1 — chrome only in Foundation. The 380px right dock
// at >=1280px; live chat, streaming, and citations arrive with the Ask Vela
// module (a later phase) — this establishes the persistent entry point the
// design system's "AI as a colleague with read access to the books" posture
// (Design System 1.7) depends on existing everywhere from day one.
export function AskVelaDock() {
  return (
    <aside
      aria-label="Ask Vela"
      className="border-border bg-surface-raised hidden w-[380px] shrink-0 flex-col border-l xl:flex"
    >
      <div className="border-border flex h-14 items-center gap-2 border-b px-4">
        <Sparkles className="text-data-aiAccent size-4" aria-hidden />
        <span className="font-ui text-text-primary text-[1rem] font-semibold">Ask Vela</span>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="font-ui text-text-secondary text-[0.875rem]">
          Ask Vela isn&apos;t connected yet — this panel is reserved for the AI assistant, coming in
          a later phase.
        </p>
      </div>
    </aside>
  );
}
