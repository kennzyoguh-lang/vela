import Link from "next/link";
import { Zap } from "lucide-react";
import type { Invoice } from "@vela/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { invoiceBadgeStatus, invoiceStatusLabel, riskLabel } from "@/lib/invoice-status";
import { formatMoney, formatDuePhrase } from "@/lib/format";

// Design System 4.25 — client name + amount, invoice number + due phrase,
// status badge + risk dot-scale. One invoice per card, never a table row
// pretending to be one (Card's 4.8 rule). Quick Sale rows (no linked
// client — see Invoice.source) get a small bolt icon so they're
// distinguishable from manual invoices at a glance, not just by their
// "Quick Sale" client-name label.
export function InvoiceCard({ invoice, clientName }: { invoice: Invoice; clientName: string }) {
  const risk = riskLabel(invoice.riskScore);

  return (
    <Link href={`/invoices/${invoice.id}`}>
      <Card className="hover:border-data-aiAccent flex items-center justify-between gap-4 transition-colors">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {invoice.source === "quick_sale" ? (
              <Zap className="text-gold size-4 shrink-0" aria-hidden />
            ) : null}
            <p className="font-ui text-text-primary truncate text-[0.875rem] font-semibold">
              {clientName}
            </p>
            <Badge
              status={invoiceBadgeStatus(invoice.status)}
              label={invoiceStatusLabel(invoice.status)}
            />
          </div>
          <p className="text-text-secondary mt-1 font-mono text-[0.75rem]">
            {invoice.number} · {formatDuePhrase(invoice.dueDate, invoice.status)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="font-ui text-text-primary text-[1rem] font-bold">
            {formatMoney(invoice.total, invoice.currency)}
          </p>
          <p className={`font-ui text-[0.75rem] ${risk.className}`}>{risk.label}</p>
        </div>
      </Card>
    </Link>
  );
}
