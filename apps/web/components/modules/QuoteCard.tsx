import Link from "next/link";
import type { Quote } from "@vela/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { quoteBadgeStatus, quoteStatusLabel, formatValidUntilPhrase } from "@/lib/quote-status";
import { formatMoney } from "@/lib/format";

// Mirrors InvoiceCard.tsx exactly — one quote per card (Card's 4.8 rule),
// client name + amount, quote number + valid-until phrase, status badge.
export function QuoteCard({ quote, clientName }: { quote: Quote; clientName: string }) {
  return (
    <Link href={`/quotes/${quote.id}`}>
      <Card className="hover:border-data-aiAccent flex items-center justify-between gap-4 transition-colors">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-ui text-text-primary truncate text-[0.875rem] font-semibold">
              {clientName}
            </p>
            <Badge status={quoteBadgeStatus(quote.status)} label={quoteStatusLabel(quote.status)} />
          </div>
          <p className="text-text-secondary mt-1 font-mono text-[0.75rem]">
            {quote.number} · {formatValidUntilPhrase(quote.validUntil, quote.status)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="font-ui text-text-primary text-[1rem] font-bold">
            {formatMoney(quote.total, quote.currency)}
          </p>
        </div>
      </Card>
    </Link>
  );
}
