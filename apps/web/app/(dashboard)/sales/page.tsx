"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page, Sale } from "@vela/types";
import { ListTemplate } from "@/components/templates/ListTemplate";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { api, ApiError } from "@/lib/api/client";

// Owner/admin back-office view of every Quick Sale — SaleStatus has had
// "voided" as a value since the POS feature shipped, but nothing ever let
// anyone actually set it (sale.service.ts#voidSale's own comment explains
// the gap). Voiding here removes the sale from cash-check's expected-cash
// math immediately, same "recomputed fresh, never snapshotted"
// reasoning as invoice voiding.
export default function SalesPage() {
  const queryClient = useQueryClient();
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: salePage, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => api.get<Page<Sale>>("/v1/sales?pageSize=100"),
    staleTime: 30_000,
  });
  const sales = salePage?.items;

  const voidMutation = useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason: string }) =>
      api.post<Sale>(`/v1/sales/${saleId}/void`, { reason }),
    onSuccess: () => {
      setVoidingId(null);
      setVoidReason("");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["staff-leaderboard"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't void this sale."),
  });

  return (
    <ListTemplate title="Sales">
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !sales || sales.length === 0 ? (
        <Card>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No Quick Sale transactions yet.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {error ? <Alert variant="danger" title={error} /> : null}
          {sales.map((sale) => (
            <Card key={sale.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-ui text-text-primary truncate text-[0.875rem] font-semibold">
                    {sale.customerName ?? "Walk-in customer"}
                  </p>
                  <p className="font-data text-text-secondary text-[0.75rem] tabular-nums">
                    {new Date(sale.soldAt).toLocaleString()} · {sale.items.length} item
                    {sale.items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-data text-text-primary text-[0.875rem] font-bold tabular-nums">
                    {formatMoney(sale.total, sale.currency)}
                  </span>
                  {sale.status === "voided" ? (
                    <Badge status="archived" label="Voided" />
                  ) : (
                    <Badge status="active" label="Completed" />
                  )}
                </div>
              </div>
              {sale.status === "voided" && sale.voidedReason ? (
                <p className="font-ui text-text-secondary text-[0.75rem]">
                  Voided: {sale.voidedReason}
                </p>
              ) : sale.status === "completed" ? (
                <div className="flex justify-end">
                  {voidingId === sale.id ? (
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <Input
                          label="Reason for voiding"
                          value={voidReason}
                          onChange={(e) => setVoidReason(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setVoidingId(null)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={!voidReason.trim()}
                          loading={voidMutation.isPending}
                          onClick={() => {
                            setError(null);
                            voidMutation.mutate({ saleId: sale.id, reason: voidReason.trim() });
                          }}
                        >
                          Confirm void
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        setVoidingId(sale.id);
                      }}
                    >
                      Void sale
                    </Button>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </ListTemplate>
  );
}
