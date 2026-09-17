"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExpenseClaim, ExpenseClaimCategory, Page, ScannedReceipt } from "@vela/types";
import { ListTemplate } from "@/components/templates/ListTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { api, ApiError, uploadFile } from "@/lib/api/client";

interface CurrentUserSummary {
  role: string;
}

const CATEGORY_OPTIONS: { value: ExpenseClaimCategory; label: string }[] = [
  { value: "cost_of_goods", label: "Cost of goods" },
  { value: "payroll", label: "Payroll" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "marketing", label: "Marketing" },
  { value: "transport", label: "Transport" },
  { value: "other_expense", label: "Other" },
];

function statusBadge(status: ExpenseClaim["status"]) {
  if (status === "approved") return <Badge status="active" label="Approved" />;
  if (status === "rejected") return <Badge status="overdue" label="Rejected" />;
  return <Badge status="partial" label="Pending" />;
}

// Reimbursement tracking, not a P&L input — a claim never appears in the
// Money page's P&L, which derives purely from categorized bank
// transactions (expense-claim.service.ts's own comment explains why those
// are genuinely different facts, not the same one twice).
export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<ExpenseClaimCategory | "">("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [receiptFileId, setReceiptFileId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<CurrentUserSummary>("/v1/auth/me"),
    staleTime: 60_000,
  });
  const isOwnerOrAdmin = currentUser?.role === "owner" || currentUser?.role === "admin";

  const { data: claimPage, isLoading } = useQuery({
    queryKey: ["expense-claims"],
    queryFn: () => api.get<Page<ExpenseClaim>>("/v1/expense-claims?pageSize=100"),
    staleTime: 30_000,
  });
  const claims = claimPage?.items;

  const scanMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("receipt", file);
      return uploadFile<ScannedReceipt>("/v1/receipts/scan", formData);
    },
    onSuccess: ({ storedFileId, extracted }) => {
      setReceiptFileId(storedFileId);
      if (extracted?.vendor) setVendor(extracted.vendor);
      if (extracted?.amount) setAmount(String(extracted.amount));
      if (extracted?.date) setExpenseDate(extracted.date);
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Couldn't scan that receipt."),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post("/v1/expense-claims", {
        category,
        vendor,
        amount: Number(amount),
        expenseDate,
        description: description || undefined,
        receiptFileId: receiptFileId ?? undefined,
      }),
    onSuccess: () => {
      setCategory("");
      setVendor("");
      setAmount("");
      setExpenseDate("");
      setDescription("");
      setReceiptFileId(null);
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Couldn't submit this claim."),
  });

  const approveMutation = useMutation({
    mutationFn: (claimId: string) => api.post(`/v1/expense-claims/${claimId}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expense-claims"] }),
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Couldn't approve this claim."),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ claimId, reason }: { claimId: string; reason: string }) =>
      api.post(`/v1/expense-claims/${claimId}/reject`, { reason }),
    onSuccess: () => {
      setRejectingId(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
    },
    onError: (err) =>
      setActionError(err instanceof ApiError ? err.message : "Couldn't reject this claim."),
  });

  return (
    <ListTemplate title="Expenses" eyebrow="Money">
      <Card accent className="flex flex-col gap-3">
        <CardHeader>
          <CardTitle eyebrow>Submit a claim</CardTitle>
        </CardHeader>
        {formError ? <Alert variant="danger" title={formError} /> : null}
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            submitMutation.mutate();
          }}
        >
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]">
              Receipt photo (optional — auto-fills the fields below)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFormError(null);
                  scanMutation.mutate(file);
                }
              }}
              className="font-ui text-text-secondary text-[0.8125rem]"
            />
            {scanMutation.isPending ? (
              <p className="font-ui text-text-secondary text-[0.75rem]">Scanning receipt…</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="category"
              className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]"
            >
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseClaimCategory)}
              className="border-border bg-surface-raised font-ui text-text-primary h-10 rounded-sm border px-3"
              required
            >
              <option value="" disabled>
                Choose one
              </option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            required
          />
          <Input
            label="Amount (₦)"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Input
            label="Date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
          />
          <div className="sm:col-span-2">
            <Input
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            loading={submitMutation.isPending}
            disabled={!category || !vendor || !amount || !expenseDate}
            className="sm:col-span-2 sm:self-start"
          >
            Submit claim
          </Button>
        </form>
      </Card>

      <div className="mt-4">
        {actionError ? <Alert variant="danger" title={actionError} /> : null}
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !claims || claims.length === 0 ? (
          <Card>
            <p className="font-ui text-text-secondary text-[0.875rem]">
              No expense claims {isOwnerOrAdmin ? "yet" : "submitted yet"}.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {claims.map((claim) => (
              <Card key={claim.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-ui text-text-primary truncate text-[0.875rem] font-semibold">
                      {claim.vendor}
                      {claim.submittedByUser ? ` — ${claim.submittedByUser.name}` : ""}
                    </p>
                    <p className="font-data text-text-secondary text-[0.75rem] tabular-nums">
                      {CATEGORY_OPTIONS.find((c) => c.value === claim.category)?.label ??
                        claim.category}{" "}
                      · {new Date(claim.expenseDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-data text-text-primary text-[0.875rem] font-bold tabular-nums">
                      {formatMoney(claim.amount, claim.currency)}
                    </span>
                    {statusBadge(claim.status)}
                  </div>
                </div>
                {claim.description ? (
                  <p className="font-ui text-text-secondary text-[0.8125rem]">
                    {claim.description}
                  </p>
                ) : null}
                {claim.status === "rejected" && claim.reviewNote ? (
                  <p className="font-ui text-rust text-[0.75rem]">Rejected: {claim.reviewNote}</p>
                ) : null}
                {isOwnerOrAdmin && claim.status === "pending" ? (
                  <div className="flex justify-end">
                    {rejectingId === claim.id ? (
                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <Input
                            label="Reason for rejecting"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRejectingId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={!rejectReason.trim()}
                            loading={rejectMutation.isPending}
                            onClick={() => {
                              setActionError(null);
                              rejectMutation.mutate({
                                claimId: claim.id,
                                reason: rejectReason.trim(),
                              });
                            }}
                          >
                            Confirm reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActionError(null);
                            setRejectingId(claim.id);
                          }}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={
                            approveMutation.isPending && approveMutation.variables === claim.id
                          }
                          onClick={() => {
                            setActionError(null);
                            approveMutation.mutate(claim.id);
                          }}
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </ListTemplate>
  );
}
