import type { PnlStatement as PnlStatementData } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { categoryLabel } from "@/lib/transaction-category";
import { formatMoney } from "@/lib/format";

// Design System 2.3-style statement: income, expenses by category, then a
// bold net-profit total — a KPI figure, not buried in the middle of a table.
export function PnlStatement({
  statement,
  currency,
}: {
  statement: PnlStatementData;
  currency: string;
}) {
  const expenseEntries = Object.entries(statement.expensesByCategory) as [
    keyof typeof statement.expensesByCategory,
    number,
  ][];

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Profit &amp; loss</CardTitle>
      </CardHeader>
      <div className="flex items-center justify-between">
        <span className="font-ui text-text-secondary text-[0.875rem]">Income</span>
        <span className="font-ui text-text-primary text-[0.875rem] font-semibold">
          {formatMoney(statement.income, currency)}
        </span>
      </div>
      <div className="border-border flex flex-col gap-2 border-t pt-3">
        <p className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]">
          Expenses
        </p>
        {expenseEntries.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">No expenses in this period.</p>
        ) : (
          expenseEntries.map(([category, amount]) => (
            <div key={category} className="flex items-center justify-between">
              <span className="font-ui text-text-secondary text-[0.875rem]">
                {categoryLabel(category)}
              </span>
              <span className="font-ui text-text-primary text-[0.875rem]">
                {formatMoney(amount ?? 0, currency)}
              </span>
            </div>
          ))
        )}
        <div className="flex items-center justify-between">
          <span className="font-ui text-text-secondary text-[0.875rem] font-semibold">
            Total expenses
          </span>
          <span className="font-ui text-text-primary text-[0.875rem] font-semibold">
            {formatMoney(statement.totalExpenses, currency)}
          </span>
        </div>
      </div>
      <div className="border-border flex items-center justify-between border-t pt-3">
        <span className="font-ui text-text-primary text-[1rem] font-bold">Net profit</span>
        <span
          className={`font-ui text-[1.25rem] font-bold ${statement.netProfit >= 0 ? "text-sage" : "text-rust"}`}
        >
          {formatMoney(statement.netProfit, currency)}
        </span>
      </div>
    </Card>
  );
}
