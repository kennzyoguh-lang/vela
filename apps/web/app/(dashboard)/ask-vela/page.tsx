import { ChatPanel } from "@/components/modules/ask-vela/ChatPanel";

export default function AskVelaPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-text-primary text-[1.5rem] font-bold">Ask Vela</h1>
        <p className="font-ui text-text-secondary text-[0.875rem]">
          Ask about your invoices, compliance deadlines, cash position, or payroll — grounded in
          this business&apos;s own records.
        </p>
      </div>
      <div className="border-border bg-surface-raised h-[75vh] min-h-[500px] rounded-lg border">
        <ChatPanel variant="full" />
      </div>
    </div>
  );
}
