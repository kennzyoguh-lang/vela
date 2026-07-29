"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Client } from "@vela/types";
import { createClientSchema, type CreateClientFormValues } from "@/lib/validation/client.schema";
import { FlowTemplate } from "@/components/templates/FlowTemplate";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { api, ApiError } from "@/lib/api/client";

export default function NewClientPage() {
  return (
    <Suspense>
      <NewClientForm />
    </Suspense>
  );
}

function NewClientForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  // Reached from the invoice quick-create flow when no client exists yet —
  // returning there afterwards instead of the clients list (Design System 5.7).
  const returnTo = searchParams.get("returnTo");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { paymentTerms: 14 },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateClientFormValues) =>
      api.post<Client>("/v1/clients", { ...values, email: values.email || undefined }),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      router.push(returnTo ? `${returnTo}?clientId=${client.id}` : "/clients");
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Couldn't add the client."),
  });

  return (
    <FlowTemplate
      step={1}
      totalSteps={1}
      title="Add a client"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="new-client-form"
            loading={isSubmitting || createMutation.isPending}
          >
            Save client
          </Button>
        </>
      }
    >
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <form
        id="new-client-form"
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="flex flex-col gap-4"
        noValidate
      >
        <Input label="Client name" {...register("name")} error={errors.name?.message} required />
        <Input
          label="Email"
          type="email"
          helperText="Used to send invoices and payment reminders"
          {...register("email")}
          error={errors.email?.message}
        />
        <Input label="Phone" {...register("phone")} error={errors.phone?.message} />
        <Input
          label="Payment terms (days)"
          type="number"
          {...register("paymentTerms")}
          error={errors.paymentTerms?.message}
        />
      </form>
    </FlowTemplate>
  );
}
