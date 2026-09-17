"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BankAccount,
  BankTransaction,
  CashFlowProjection,
  CashFlowStatement,
  Page,
  PnlStatement as PnlStatementData,
  TransactionCategory,
} from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { BankAccountCard } from "@/components/modules/BankAccountCard";
import { PnlStatement } from "@/components/modules/PnlStatement";
import { CashFlowCard } from "@/components/modules/CashFlowCard";
import { MonoConnectButton } from "@/components/modules/MonoConnectButton";
import { ReconciliationCard } from "@/components/modules/ReconciliationCard";
import { formatMoney } from "@/lib/format";
import {
  RECATEGORIZABLE_CATEGORIES,
  categoryBadgeStatus,
  categoryLabel,
} from "@/lib/transaction-category";
import { api } from "@/lib/api/client";
import { useModuleVisibility } from "@/lib/business-profile/useModuleVisibility";
import { cn } from "@/lib/utils";

type Period = "this_month" | "last_month";

// Design System 4.17 — both statements on this page are the same object: a
// titled card of label/figure rows with a bold total ruled off at the bottom
// (see PnlStatement.tsx and CashFlowCard.tsx). One shared skeleton mirrors
// that exactly, in place of the `h-64 w-full` and `h-48 w-full` grey blocks
// that told the reader nothing about what was arriving.
function StatementSkeleton({ rows }: { rows: number }) {
  return (
    <Card className="flex flex-col gap-3">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center justify-between gap-4">
          <Skeleton className="h-3.5 w-[min(45%,180px)]" />
          <Skeleton className="h-3.5 w-24 shrink-0" />
        </div>
      ))}
      <div className="border-border flex items-center justify-between gap-4 border-t pt-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-32 shrink-0" />
      </div>
    </Card>
  );
}

// Empty and error both render inside the card the statement would have
// occupied, so the page keeps its shape instead of collapsing to a floating
// sentence — and both read as plain language with a way forward rather than a
// red one-liner (the danger colour is reserved for something the owner has to
// act on, not a request that needs retrying).
function StatementMessage({ children }: { children: ReactNode }) {
  return (
    <Card>
      <p className="font-ui text-text-secondary text-[0.875rem]">{children}</p>
    </Card>
  );
}

function periodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = period === "this_month" ? now.getMonth() : now.getMonth() - 1;
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function MoneyPage() {
  const queryClient = useQueryClient();
  const { visibility } = useModuleVisibility();
  const [period, setPeriod] = useState<Period>("this_month");
  const { from, to } = periodRange(period);

  const {
    data: accounts,
    isLoading: accountsLoading,
    error: accountsError,
  } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<BankAccount[]>("/v1/bank-accounts"),
    staleTime: 60_000,
  });

  const {
    data: statement,
    isLoading: statementLoading,
    error: statementError,
  } = useQuery({
    queryKey: ["pnl", from, to],
    queryFn: () => api.get<PnlStatementData>(`/v1/pnl?from=${from}&to=${to}`),
    staleTime: 60_000,
    // Full P&L Intelligence is gated (business profiling) — skip the
    // request entirely rather than fetching data the page won't render.
    enabled: visibility.fullPnl,
  });

  const {
    data: cashFlowStatement,
    isLoading: cashFlowLoading,
    error: cashFlowError,
  } = useQuery({
    queryKey: ["cash-flow", "statement", from, to],
    queryFn: () => api.get<CashFlowStatement>(`/v1/cash-flow/statement?from=${from}&to=${to}`),
    staleTime: 60_000,
    enabled: visibility.fullPnl,
  });

  const { data: cashFlowProjection } = useQuery({
    queryKey: ["cash-flow", "projection"],
    queryFn: () => api.get<CashFlowProjection>("/v1/cash-flow/projection"),
    staleTime: 60_000,
    enabled: visibility.fullPnl,
  });

  const {
    data: transactionPage,
    isLoading: transactionsLoading,
    error: transactionsError,
  } = useQuery({
    queryKey: ["bank-transactions"],
    queryFn: () => api.get<Page<BankTransaction>>("/v1/bank-transactions?pageSize=100"),
    staleTime: 30_000,
  });
  const transactions = transactionPage?.items;

  const recategorizeMutation = useMutation({
    mutationFn: ({ id, category }: { id: string; category: TransactionCategory }) =>
      api.patch(`/v1/bank-transactions/${id}/category`, { category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["pnl"] });
    },
  });

  const totalCashPosition = useMemo(
    () => (accounts ?? []).reduce((sum, acc) => sum + parseFloat(acc.currentBalance), 0),
    [accounts],
  );
  const currency = accounts?.[0]?.currency ?? "NGN";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Money" title="Money" action={<MonoConnectButton />} />

      <Link href="/expenses" className="font-ui text-cobalt -mt-2 inline-block text-[0.8125rem]">
        Submit or review an expense claim →
      </Link>

      <Card accent>
        <CardHeader>
          <CardTitle eyebrow>Cash position</CardTitle>
        </CardHeader>
        {accountsLoading ? (
          // Design System 4.17 — the skeleton is the real layout with the
          // words taken out: the 1.5rem total, then one row per account card.
          // A lone `h-8 w-1/3` bar told the user nothing about what was coming.
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-[45%] max-w-[220px]" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-[68px] w-full" />
              <Skeleton className="h-[68px] w-full" />
            </div>
          </div>
        ) : accountsError ? (
          // Previously a failed request fell through to the empty branch below
          // and told the owner "No bank accounts connected yet." — an
          // outright false statement about their own money, and the one thing
          // this page must never get wrong.
          <p className="font-ui text-text-secondary text-[0.875rem]">
            We couldn&apos;t reach your bank accounts just now. Your balances are safe — refresh in
            a moment to try again.
          </p>
        ) : !accounts || accounts.length === 0 ? (
          // Design System 4.18 — a first-use empty state names the next action
          // instead of stating an absence. The connect control is repeated
          // here rather than only in the page header, where a new owner with
          // nothing on screen has to go hunting for it.
          <div className="flex flex-col items-start gap-3">
            <p className="font-ui text-text-secondary text-[0.875rem]">
              Connect a bank account and Vela keeps your balance, transactions and P&amp;L up to
              date on its own.
            </p>
            <MonoConnectButton />
          </div>
        ) : (
          <>
            <p className="font-data text-text-primary mb-3 text-[1.5rem] font-bold tabular-nums">
              {formatMoney(totalCashPosition, currency)}
            </p>
            <div className="flex flex-col gap-2">
              {accounts.map((account) => (
                <BankAccountCard key={account.id} account={account} />
              ))}
            </div>
          </>
        )}
      </Card>

      {accounts && accounts.length > 0 ? <ReconciliationCard currency={currency} /> : null}

      {visibility.fullPnl ? (
        // The period toggle governs the two statements underneath it, so it
        // sits 12px from them inside one group rather than floating at the
        // page's uniform 24px rhythm, equidistant from the cash card above
        // that it has nothing to do with.
        <section className="flex flex-col gap-3" aria-label="Profit, loss and cash flow">
          {/* A real segmented control: one recessed track, the selected
              segment raised out of it. The previous version gave the selected
              period `bg-midnight`, which IS --surface-canvas in dark theme —
              so the chosen period vanished into the page while the unchosen
              one sat on a lighter chip, reading as selected. The track/raised
              pairing below reverses correctly in both themes because it moves
              along the surface ramp instead of naming a fixed colour. */}
          <div
            className="bg-surface-secondary rounded-pill inline-flex gap-1 self-start p-1"
            role="group"
            aria-label="Reporting period"
          >
            {(["this_month", "last_month"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                // aria-pressed, not just a visual swap: which period you're
                // reading has to survive being read aloud too.
                aria-pressed={period === p}
                className={cn(
                  // h-11 kept from the original: 44px is the tap-target floor,
                  // and a segmented control is a thumb target on mobile.
                  "font-ui rounded-pill duration-quick h-11 px-4 text-[0.8125rem] font-semibold transition-colors",
                  period === p
                    ? "bg-surface-overlay text-text-primary shadow-1"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {p === "this_month" ? "This month" : "Last month"}
              </button>
            ))}
          </div>

          {statementLoading ? (
            <StatementSkeleton rows={5} />
          ) : statementError ? (
            <StatementMessage>
              We couldn&apos;t put your P&amp;L together for this period. Try switching periods, or
              refresh in a moment.
            </StatementMessage>
          ) : statement ? (
            <PnlStatement statement={statement} currency={currency} />
          ) : (
            <StatementMessage>
              No income or expenses recorded for{" "}
              {period === "this_month" ? "this month" : "last month"} yet. Categorised transactions
              build this statement automatically.
            </StatementMessage>
          )}

          {cashFlowLoading ? (
            <StatementSkeleton rows={3} />
          ) : cashFlowError ? (
            <StatementMessage>
              We couldn&apos;t work out your cash flow for this period. Refresh in a moment to try
              again.
            </StatementMessage>
          ) : cashFlowStatement ? (
            <CashFlowCard
              statement={cashFlowStatement}
              projection={cashFlowProjection}
              currency={currency}
            />
          ) : null}
        </section>
      ) : null}

      <Card accent>
        <CardHeader>
          <CardTitle eyebrow>Transactions</CardTitle>
        </CardHeader>
        {transactionsLoading ? (
          // Design System 4.17 — three rows shaped like real ones (narration
          // over date on the left, figure on the right), not two grey slabs.
          <div className="divide-border flex flex-col divide-y">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-[min(70%,260px)]" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-24 shrink-0" />
              </div>
            ))}
          </div>
        ) : transactionsError ? (
          // Same correction as the cash card above — a failed request used to
          // render as "No transactions synced yet.", which reads as a fact
          // about the account rather than a problem with the connection.
          <p className="font-ui text-text-secondary text-[0.875rem]">
            We couldn&apos;t load your transactions just now. Refresh in a moment to try again.
          </p>
        ) : !transactions || transactions.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">
            {accounts && accounts.length > 0
              ? "No transactions yet. New ones appear here automatically once your bank sends them through — usually within a day."
              : "Transactions appear here automatically once a bank account is connected."}
          </p>
        ) : (
          <div className="divide-border flex flex-col divide-y">
            {transactions.map((tx) => {
              const pending =
                recategorizeMutation.isPending && recategorizeMutation.variables?.id === tx.id;
              return (
                <div
                  key={tx.id}
                  // At 375px the old single row crushed narration, amount,
                  // badge and a <select> into one line. Below sm the row
                  // becomes two bands — identity above, money and category
                  // below — and only re-forms as one line when there's room.
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-ui text-text-primary truncate text-[0.875rem]">
                      {tx.narration}
                    </p>
                    {/* font-data, not font-mono: font-mono is Tailwind's own
                        default stack and bypasses --font-data, so this date
                        was the one figure on the page not set in the ledger
                        typeface (Handbook 4.4). */}
                    <p className="font-data text-text-secondary mt-0.5 text-[0.75rem] tabular-nums">
                      {new Date(tx.transactionDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <p
                      className={cn(
                        "font-data shrink-0 text-[0.875rem] font-bold tabular-nums",
                        // Sign and colour together, never colour alone
                        // (Design System 4.14) — the +/- already carries the
                        // meaning for anyone who can't separate sage from
                        // the body colour.
                        tx.type === "credit" ? "text-sage" : "text-text-primary",
                      )}
                    >
                      {tx.type === "credit" ? "+" : "-"}
                      {formatMoney(tx.amount, currency)}
                    </p>
                    <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
                      <Badge
                        status={categoryBadgeStatus(tx.category)}
                        label={categoryLabel(tx.category)}
                      />
                      <select
                        aria-label={`Recategorize ${tx.narration}`}
                        value={tx.category}
                        // Recategorising re-runs the P&L behind the scenes;
                        // without this the control stayed live and identical
                        // through the round trip, so a slow connection looked
                        // like the change hadn't registered.
                        disabled={pending}
                        onChange={(e) =>
                          recategorizeMutation.mutate({
                            id: tx.id,
                            category: e.target.value as TransactionCategory,
                          })
                        }
                        // h-10, not h-8/h-9: tailwind.config.ts's `spacing`
                        // block redefines keys 0-9, so `h-8` resolves to
                        // --space-8 (64px) and `h-9` to --space-9 (96px) —
                        // this control was rendering ~2x its intended height.
                        // 10-12 are untouched by that block and behave as the
                        // normal sizing scale, and 40px sits just under the
                        // Badge it's paired with.
                        className="border-border bg-surface-raised font-ui text-text-primary hover:border-border-strong duration-quick h-10 rounded-sm border px-2 text-[0.75rem] transition-colors disabled:opacity-50"
                      >
                        {RECATEGORIZABLE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {categoryLabel(category)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
