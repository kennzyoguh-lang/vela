"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  requestPasswordResetSchema,
  type RequestPasswordResetFormValues,
} from "@/lib/validation/auth.schema";
import { api } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

// AUTH_PATHS, not PUBLIC_PATHS (middleware.ts) — same "makes no sense while
// already logged in" reasoning as /login and /signup, unlike /verify-email
// or /reset-password's own token-consuming step.
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestPasswordResetFormValues>({
    resolver: zodResolver(requestPasswordResetSchema),
  });

  async function onSubmit(values: RequestPasswordResetFormValues) {
    // Always the same outcome regardless of what the API actually did —
    // apps/api/src/services/auth.service.ts#requestPasswordReset never
    // reveals whether the address has an account, so the UI can't either.
    await api.post("/v1/auth/forgot-password", values).catch(() => {});
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="bg-sage/10 flex size-12 items-center justify-center rounded-full">
          <MailCheck className="text-sage size-6" aria-hidden />
        </div>
        <div>
          <h1 className="font-ui text-text-primary text-[1.25rem] font-semibold">
            Check your inbox
          </h1>
          <p className="font-ui text-text-secondary mt-1 text-[0.875rem]">
            If an account exists for that email, we&apos;ve sent a link to reset your password. It
            expires in 30 minutes.
          </p>
        </div>
        <Link
          href="/login"
          className="font-ui text-data-aiAccent inline-flex items-center gap-1 text-[0.875rem] hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="font-ui text-text-primary text-center text-[1.25rem] font-semibold">
          Forgot your password?
        </h1>
        <p className="font-ui text-text-secondary mt-1 text-center text-[0.875rem]">
          Enter the email on your account and we&apos;ll send you a reset link.
        </p>
      </div>
      <Input
        label="Email"
        type="email"
        autoFocus
        {...register("email")}
        error={errors.email?.message}
        required
      />
      <Button type="submit" loading={isSubmitting} className="w-full">
        Send reset link
      </Button>
      <Link
        href="/login"
        className="font-ui text-text-secondary inline-flex items-center justify-center gap-1 text-[0.8125rem] hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to log in
      </Link>
    </form>
  );
}
