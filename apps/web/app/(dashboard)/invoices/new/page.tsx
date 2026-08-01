"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Client, Invoice, Page } from "@vela/types";
import {
  quickCreateInvoiceSchema,
  type QuickCreateInvoiceFormValues,
} from "@/lib/validation/invoice.schema";
import { FlowTemplate } from "@/components/templates/FlowTemplate";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { api, ApiError } from "@/lib/api/client";

// Design System 5.7's 3-field progressive flow — client, amount, due date.
// Everything else (line items, tax, discount) is reached from the invoice
// detail view afterwards, never demanded upfront.
export default function NewInvoicePage() {
  return (
    <Suspense fallback={null}>
      <NewInvoiceForm />
    </Suspense>
  );
}

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const preselectedClientId = searchParams.get("clientId") ?? undefined;

  const { data: clientPage, isLoading: clientsLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<Page<Client>>("/v1/clients?pageSize=100"),
    staleTime: 5 * 60_000,
  });
  const clients = clientPage?.items;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuickCreateInvoiceFormValues>({
    resolver: zodResolver(quickCreateInvoiceSchema),
    defaultValues: { currency: "NGN", clientId: preselectedClientId },
  });

  useEffect(() => {
    if (preselectedClientId) setValue("clientId", preselectedClientId);
  }, [preselectedClientId, setValue]);

  const createMutation = useMutation({
    mutationFn: (values: QuickCreateInvoiceFormValues) =>
      api.post<Invoice>("/v1/invoices/quick-create", values),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Couldn't create the invoice."),
  });

  if (!clientsLoading && (!clients || clients.length === 0)) {
    return (
      <FlowTemplate step={1} totalSteps={1} title="New invoice" footer={null}>
        <Alert variant="info" title="Add a client first">
          You need at least one client before you can create an invoice.
        </Alert>
        <Link href="/clients/new?returnTo=/invoices/new" className="mt-4 inline-block">
          <Button>Add client</Button>
        </Link>
      </FlowTemplate>
    );
  }

  return (
    <FlowTemplate
      step={1}
      totalSteps={1}
      title="New invoice"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="quick-create-invoice-form"
            loading={isSubmitting || createMutation.isPending}
          >
            Create invoice
          </Button>
        </>
      }
    >
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <form
        id="quick-create-invoice-form"
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="clientId"
            className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]"
          >
            Client <span className="text-status-danger">*</span>
          </label>
          <select
            id="clientId"
            {...register("clientId")}
            defaultValue={preselectedClientId ?? ""}
            className="border-border bg-surface-raised font-ui text-text-primary h-10 rounded-sm border px-3"
          >
            <option value="" disabled>
              Choose a client
            </option>
            {clients?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {errors.clientId ? (
            <p className="text-status-danger text-[0.75rem]">{errors.clientId.message}</p>
          ) : null}
        </div>
        <Input
          label="Amount"
          type="number"
          step="0.01"
          {...register("amount")}
          error={errors.amount?.message}
          required
        />
        <Input
          label="Due date"
          type="date"
          {...register("dueDate")}
          error={errors.dueDate?.message}
          required
        />
      </form>
    </FlowTemplate>
  );
}
