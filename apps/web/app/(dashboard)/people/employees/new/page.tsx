"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Employee } from "@vela/types";
import {
  createEmployeeSchema,
  type CreateEmployeeFormValues,
} from "@/lib/validation/payroll.schema";
import { FlowTemplate } from "@/components/templates/FlowTemplate";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { api, ApiError } from "@/lib/api/client";

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
] as const;

export default function NewEmployeePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: { employmentType: "full_time" },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateEmployeeFormValues) =>
      api.post<Employee>("/v1/employees", { ...values, email: values.email || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      router.push("/people");
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Couldn't add the employee."),
  });

  return (
    <FlowTemplate
      step={1}
      totalSteps={1}
      title="Add an employee"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="new-employee-form"
            loading={isSubmitting || createMutation.isPending}
          >
            Save employee
          </Button>
        </>
      }
    >
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <form
        id="new-employee-form"
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="flex flex-col gap-4"
        noValidate
      >
        <Input label="Full name" {...register("name")} error={errors.name?.message} required />
        <Input label="Email" type="email" {...register("email")} error={errors.email?.message} />
        <Input
          label="Job title"
          {...register("jobTitle")}
          error={errors.jobTitle?.message}
          required
        />
        <div className="flex flex-col gap-1">
          <label
            htmlFor="employmentType"
            className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]"
          >
            Employment type
          </label>
          <select
            id="employmentType"
            {...register("employmentType")}
            className="border-border bg-surface-raised font-ui text-text-primary h-10 rounded-sm border px-3"
          >
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Basic salary (monthly)"
          type="number"
          step="0.01"
          {...register("basicSalary")}
          error={errors.basicSalary?.message}
          required
        />
        <Input
          label="Housing allowance (monthly)"
          type="number"
          step="0.01"
          helperText="Optional"
          {...register("housingAllowance")}
          error={errors.housingAllowance?.message}
        />
        <Input
          label="Transport allowance (monthly)"
          type="number"
          step="0.01"
          helperText="Optional"
          {...register("transportAllowance")}
          error={errors.transportAllowance?.message}
        />
        <Input
          label="Other allowances (monthly)"
          type="number"
          step="0.01"
          helperText="Optional"
          {...register("otherAllowances")}
          error={errors.otherAllowances?.message}
        />
        <Input
          label="Start date"
          type="date"
          {...register("startDate")}
          error={errors.startDate?.message}
          required
        />
      </form>
    </FlowTemplate>
  );
}
