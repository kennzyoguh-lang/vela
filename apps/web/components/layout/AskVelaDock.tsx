import { Sparkles } from "lucide-react";
import { ChatPanel } from "@/components/modules/ask-vela/ChatPanel";

// Design System 3.2/6.10/8.1 — the 380px right dock at >=1280px, live chat
// with streaming and citations (Ask Vela module, Phase 7) via ChatPanel's
// "dock" variant, grounded only in this org's own read-only data (Design
// System 1.7's "AI as a colleague with read access to the books").
export function AskVelaDock() {
  return (
    <aside
      aria-label="Ask Vela"
      className="border-border bg-surface-raised hidden w-[380px] shrink-0 flex-col border-l xl:flex"
    >
      <div className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Sparkles className="text-data-aiAccent size-4" aria-hidden />
        <span className="font-ui text-text-primary text-[1rem] font-semibold">Ask Vela</span>
      </div>
      <div className="min-h-0 flex-1">
        <ChatPanel variant="dock" />
      </div>
    </aside>
  );
}
