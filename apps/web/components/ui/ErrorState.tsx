import { OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Shared content for every route-segment error.tsx boundary (root,
// (dashboard), pos, (auth)) — a real render/query exception reaching this
// component is unrecoverable without a reload, so the only actions offered
// are "try again" (re-renders the segment) and "go home" (escapes a broken
// route entirely). Never shows the raw error message — same reasoning as
// the API's error-handler.middleware.ts never leaking a stack trace to the
// client, just plain language and a way forward.
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <OctagonAlert className="text-rust size-10" aria-hidden />
      <div>
        <p className="font-ui text-text-primary text-[1.125rem] font-bold">Something went wrong</p>
        <p className="font-ui text-text-secondary mt-1 text-[0.875rem]">
          This page ran into a problem. Try again, or go back to Home.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
        <Button onClick={() => (window.location.href = "/")}>Go to Home</Button>
      </div>
    </div>
  );
}
