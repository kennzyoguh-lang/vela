"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { signupSchema, type SignupFormValues } from "@/lib/validation/auth.schema";
import { api, ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

// Design System 5.1 — 4 fields, nothing else. Plan choice, card, and company
// questions belong to onboarding, after commitment (a later phase's scope).
export default function SignupPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { country: "NG" },
  });

  async function onSubmit(values: SignupFormValues) {
    setFormError(null);
    try {
      await api.post("/v1/auth/signup", values);
      router.push("/");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <h1 className="font-ui text-text-primary text-center text-[1.25rem] font-semibold">
        Start free
      </h1>
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <Input
        label="Business name"
        {...register("orgName")}
        error={errors.orgName?.message}
        required
      />
      <Input label="Your name" {...register("name")} error={errors.name?.message} required />
      <Input
        label="Email"
        type="email"
        {...register("email")}
        error={errors.email?.message}
        required
      />
      <Input
        label="Password"
        type="password"
        helperText="At least 10 characters"
        {...register("password")}
        error={errors.password?.message}
        required
      />
      <Button type="submit" loading={isSubmitting} className="w-full">
        Create account
      </Button>
      <p className="font-ui text-text-secondary text-center text-[0.875rem]">
        Already have an account?{" "}
        <Link href="/login" className="text-data-aiAccent hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
