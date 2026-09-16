"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, KeyRound } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validation/auth.schema";
import { api, ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

// In AUTH_PATHS (middleware.ts), same as /login and /signup — see
// forgot-password/page.tsx's comment for why this differs from
// /verify-email's PUBLIC_PATHS treatment.
export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordFormValues) {
    setFormError(null);
    try {
      await api.post("/v1/auth/reset-password", { token, newPassword: values.newPassword });
      setDone(true);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Couldn't reset your password. Try again.",
      );
    }
  }

  if (!token) {
    return (
      <Alert variant="danger" title="This reset link is missing its token">
        Request a new one from the login page.
      </Alert>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="bg-sage/10 flex size-12 items-center justify-center rounded-full">
          <CheckCircle2 className="text-sage size-6" aria-hidden />
        </div>
        <div>
          <h1 className="font-ui text-text-primary text-[1.25rem] font-semibold">
            Password updated
          </h1>
          <p className="font-ui text-text-secondary mt-1 text-[0.875rem]">
            You&apos;ve been signed out everywhere for security — log in with your new password.
          </p>
        </div>
        <Link href="/login" className="w-full">
          <Button className="w-full">Log in</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col items-center gap-2">
        <div className="bg-gold/10 flex size-12 items-center justify-center rounded-full">
          <KeyRound className="text-gold-dark size-6" aria-hidden />
        </div>
        <h1 className="font-ui text-text-primary text-center text-[1.25rem] font-semibold">
          Choose a new password
        </h1>
      </div>
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <Input
        label="New password"
        type="password"
        autoFocus
        helperText="At least 10 characters"
        {...register("newPassword")}
        error={errors.newPassword?.message}
        required
      />
      <Input
        label="Confirm new password"
        type="password"
        {...register("confirmPassword")}
        error={errors.confirmPassword?.message}
        required
      />
      <Button type="submit" loading={isSubmitting} className="w-full">
        Reset password
      </Button>
    </form>
  );
}
