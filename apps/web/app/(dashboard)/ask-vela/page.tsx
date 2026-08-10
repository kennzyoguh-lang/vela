import { PageHeader } from "@/components/ui/PageHeader";
import { ChatPanel } from "@/components/modules/ask-vela/ChatPanel";

export default function AskVelaPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="Ask Vela" title="Ask Vela" />
      <p className="font-ui text-text-secondary -mt-2 text-[0.875rem]">
        Ask about your invoices, compliance deadlines, cash position, or payroll — grounded in this
        business&apos;s own records.
      </p>
      <div className="border-border bg-surface-raised h-[75vh] min-h-[500px] rounded-lg border">
        <ChatPanel variant="full" />
      </div>
    </div>
  );
}
