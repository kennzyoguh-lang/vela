import type { CashFlowStatement, CashFlowProjection } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";

// F-33 — same statement-then-KPI shape as PnlStatement.tsx. "Operating"
// activities only (see @vela/types's CashFlowStatement comment) — this
// codebase's transaction categories can't distinguish investing/financing
// activity from ordinary operating income and expense yet.
export function CashFlowCard({
  statement,
  projection,
  currency,
}: {
  statement: CashFlowStatement;
  projection: CashFlowProjection | undefined;
  currency: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Cash flow</CardTitle>
      </CardHeader>
      <div className="flex items-center justify-between">
        <span className="font-ui text-text-secondary text-[0.875rem]">Cash in (operating)</span>
        <span className="font-ui text-text-primary text-[0.875rem] font-semibold">
          {formatMoney(statement.operatingInflow, currency)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-ui text-text-secondary text-[0.875rem]">Cash out (operating)</span>
        <span className="font-ui text-text-primary text-[0.875rem] font-semibold">
          {formatMoney(statement.operatingOutflow, currency)}
        </span>
      </div>
      <div className="border-border flex items-center justify-between border-t pt-3">
        <span className="font-ui text-text-primary text-[1rem] font-bold">Net cash flow</span>
        <span
          className={`font-data text-[1.25rem] font-bold tabular-nums ${
            statement.netCashFlow >= 0 ? "text-sage" : "text-rust"
          }`}
        >
          {formatMoney(statement.netCashFlow, currency)}
        </span>
      </div>

      {projection ? (
        <div className="border-border flex flex-col gap-2 border-t pt-3">
          <p className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]">
            Projected cash position
          </p>
          {projection.hasSufficientHistory ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-ui text-text-secondary text-[0.875rem]">In 30 days</span>
                <span className="font-ui text-text-primary text-[0.875rem] font-semibold">
                  {formatMoney(projection.projected30, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-ui text-text-secondary text-[0.875rem]">In 60 days</span>
                <span className="font-ui text-text-primary text-[0.875rem] font-semibold">
                  {formatMoney(projection.projected60, currency)}
                </span>
              </div>
              <p className="font-ui text-text-secondary text-[0.75rem]">
                Based on your average daily cash flow over the last {projection.historyDays} days.
                Not a guarantee — a projection, not a promise.
              </p>
            </>
          ) : (
            <p className="font-ui text-text-secondary text-[0.875rem]">
              Not enough transaction history yet for a reliable projection — check back once your
              bank account has synced at least two weeks of activity.
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
