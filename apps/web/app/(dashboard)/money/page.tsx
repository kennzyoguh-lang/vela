"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BankAccount,
  BankTransaction,
  Page,
  PnlStatement as PnlStatementData,
  TransactionCategory,
} from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { BankAccountCard } from "@/components/modules/BankAccountCard";
import { PnlStatement } from "@/components/modules/PnlStatement";
import { MonoConnectButton } from "@/components/modules/MonoConnectButton";
import { formatMoney } from "@/lib/format";
import {
  RECATEGORIZABLE_CATEGORIES,
  categoryBadgeStatus,
  categoryLabel,
} from "@/lib/transaction-category";
import { api } from "@/lib/api/client";
import { useModuleVisibility } from "@/lib/business-profile/useModuleVisibility";

type Period = "this_month" | "last_month";

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

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<BankAccount[]>("/v1/bank-accounts"),
    staleTime: 60_000,
  });

  const { data: statement, isLoading: statementLoading } = useQuery({
    queryKey: ["pnl", from, to],
    queryFn: () => api.get<PnlStatementData>(`/v1/pnl?from=${from}&to=${to}`),
    staleTime: 60_000,
    // Full P&L Intelligence is gated (business profiling) — skip the
    // request entirely rather than fetching data the page won't render.
    enabled: visibility.fullPnl,
  });

  const { data: transactionPage, isLoading: transactionsLoading } = useQuery({
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
      <div className="flex items-center justify-between">
        <h1 className="font-ui text-text-primary text-[1.5rem] font-bold">Money</h1>
        <MonoConnectButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cash position</CardTitle>
        </CardHeader>
        {accountsLoading ? (
          <Skeleton className="h-8 w-1/3" />
        ) : !accounts || accounts.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No bank accounts connected yet.
          </p>
        ) : (
          <>
            <p className="font-ui text-text-primary mb-3 text-[1.5rem] font-bold">
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

      {visibility.fullPnl ? (
        <>
          <div className="flex gap-2">
            {(["this_month", "last_month"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`font-ui rounded-pill h-8 px-3 text-[0.8125rem] font-semibold transition-colors ${
                  period === p
                    ? "bg-midnight text-white"
                    : "bg-surface-secondary text-text-secondary hover:bg-surface-raised"
                }`}
              >
                {p === "this_month" ? "This month" : "Last month"}
              </button>
            ))}
          </div>

          {statementLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : statement ? (
            <PnlStatement statement={statement} currency={currency} />
          ) : null}
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        {transactionsLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !transactions || transactions.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">No transactions synced yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="border-border flex items-center justify-between gap-3 border-b py-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-ui text-text-primary truncate text-[0.875rem]">
                    {tx.narration}
                  </p>
                  <p className="text-text-secondary font-mono text-[0.75rem]">
                    {new Date(tx.transactionDate).toLocaleDateString()}
                  </p>
                </div>
                <p
                  className={`font-ui shrink-0 text-[0.875rem] font-semibold ${
                    tx.type === "credit" ? "text-sage" : "text-text-primary"
                  }`}
                >
                  {tx.type === "credit" ? "+" : "-"}
                  {formatMoney(tx.amount, currency)}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    status={categoryBadgeStatus(tx.category)}
                    label={categoryLabel(tx.category)}
                  />
                  <select
                    aria-label="Recategorize transaction"
                    value={tx.category}
                    onChange={(e) =>
                      recategorizeMutation.mutate({
                        id: tx.id,
                        category: e.target.value as TransactionCategory,
                      })
                    }
                    className="border-border bg-surface-raised font-ui text-text-primary h-8 rounded-sm border px-2 text-[0.75rem]"
                  >
                    {RECATEGORIZABLE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {categoryLabel(category)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
