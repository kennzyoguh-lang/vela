"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Client, Page, Quote } from "@vela/types";
import {
  quickCreateQuoteSchema,
  type QuickCreateQuoteFormValues,
} from "@/lib/validation/quote.schema";
import { FlowTemplate } from "@/components/templates/FlowTemplate";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api/client";

// Mirrors app/(dashboard)/invoices/new/page.tsx's 3-field progressive flow
// exactly (Design System 5.7) — client, amount, expiry date.
export default function NewQuotePage() {
  return (
    <Suspense fallback={null}>
      <NewQuoteForm />
    </Suspense>
  );
}

function NewQuoteForm() {
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
  } = useForm<QuickCreateQuoteFormValues>({
    resolver: zodResolver(quickCreateQuoteSchema),
    defaultValues: { currency: "NGN", clientId: preselectedClientId },
  });

  useEffect(() => {
    if (preselectedClientId) setValue("clientId", preselectedClientId);
  }, [preselectedClientId, setValue]);

  const createMutation = useMutation({
    mutationFn: (values: QuickCreateQuoteFormValues) =>
      api.post<Quote>("/v1/quotes/quick-create", values),
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      router.push(`/quotes/${quote.id}`);
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Couldn't create the quote."),
  });

  if (clientsLoading) {
    return (
      <FlowTemplate step={1} totalSteps={1} title="New quote" footer={null}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </FlowTemplate>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <FlowTemplate step={1} totalSteps={1} title="New quote" footer={null}>
        <Alert variant="info" title="Add a client first">
          You need at least one client before you can create a quote.
        </Alert>
        <Link href="/clients/new?returnTo=/quotes/new" className="mt-4 inline-block">
          <Button>Add client</Button>
        </Link>
      </FlowTemplate>
    );
  }

  return (
    <FlowTemplate
      step={1}
      totalSteps={1}
      title="New quote"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="quick-create-quote-form"
            loading={isSubmitting || createMutation.isPending}
          >
            Create quote
          </Button>
        </>
      }
    >
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <form
        id="quick-create-quote-form"
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
          label="Valid until"
          type="date"
          {...register("validUntil")}
          error={errors.validUntil?.message}
          required
        />
      </form>
    </FlowTemplate>
  );
}
