import type { BankAccount } from "@vela/types";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";

// One account per card, never a table row pretending to be one (Card's 4.8
// rule) — same precedent as InvoiceCard/ComplianceFilingCard.
export function BankAccountCard({ account }: { account: BankAccount }) {
  return (
    <Card className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-ui text-text-primary truncate text-[0.875rem] font-semibold">
          {account.institutionName}
        </p>
        <p className="text-text-secondary mt-1 font-mono text-[0.75rem]">
          {account.accountNumberMasked} · {account.accountType}
        </p>
      </div>
      <p className="font-ui text-text-primary shrink-0 text-[1rem] font-bold">
        {formatMoney(account.currentBalance, account.currency)}
      </p>
    </Card>
  );
}
