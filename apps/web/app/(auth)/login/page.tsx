"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { loginSchema, type LoginFormValues } from "@/lib/validation/auth.schema";
import { api, ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      const result = await api.post<{ accessToken: string; requiresTwoFa: boolean }>(
        "/v1/auth/login",
        values,
      );
      if (result.requiresTwoFa) {
        router.push("/2fa");
      } else {
        router.push("/");
      }
    } catch (err) {
      // Generic message regardless of which field was wrong — never reveal
      // whether the email exists (Handbook 3.12 / Design System 6.4).
      setFormError(
        err instanceof ApiError ? "Invalid email or password" : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <h1 className="font-ui text-text-primary text-center text-[1.25rem] font-semibold">Log in</h1>
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <Input
        label="Email"
        type="email"
        autoFocus
        {...register("email")}
        error={errors.email?.message}
        required
      />
      <Input
        label="Password"
        type="password"
        {...register("password")}
        error={errors.password?.message}
        required
      />
      <div className="text-right">
        <Link
          href="/reset-password"
          className="font-ui text-data-aiAccent text-[0.75rem] hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <Button type="submit" loading={isSubmitting} className="w-full">
        Log in
      </Button>
      <p className="font-ui text-text-secondary text-center text-[0.875rem]">
        New to VELA?{" "}
        <Link href="/signup" className="text-data-aiAccent hover:underline">
          Start free
        </Link>
      </p>
    </form>
  );
}
