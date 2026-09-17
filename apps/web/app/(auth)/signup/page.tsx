"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { signupSchema, type SignupFormValues } from "@/lib/validation/auth.schema";
import { api, ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

// Design System 5.1 — 4 fields, nothing else. Plan choice, card, and company
// questions belong to onboarding, after commitment (a later phase's scope).
export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    // Prefilled when arriving from a lead-capture funnel (e.g. the FIRS
    // penalty calculator, app/firs-calculator/page.tsx) — reduces friction
    // for someone who already gave us this information once.
    defaultValues: {
      country: "NG",
      email: searchParams.get("email") ?? "",
      orgName: searchParams.get("orgName") ?? "",
      referredBy: searchParams.get("referredBy") ?? undefined,
    },
  });

  async function onSubmit(values: SignupFormValues) {
    setFormError(null);
    try {
      const result = await api.post<{ accessToken: string; requiresTwoFa: boolean }>(
        "/v1/auth/signup",
        values,
      );
      useAuthStore.getState().setAccessToken(result.accessToken);
      router.push("/onboarding");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  return (
    // Same grouped rhythm as login: header / fields / action / footer, rather
    // than seven equally-spaced rows.
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      {/* Matches login's header exactly, and through it the PageHeader every
          page inside the app uses. The eyebrow carries the promise the title
          can't ("Start free" alone says nothing about how long it takes). */}
      <div>
        <p className="font-data text-gold mb-2 text-[0.7rem] font-bold uppercase tracking-[0.14em]">
          Four fields, no card
        </p>
        <h1 className="font-display text-text-primary text-[1.75rem] font-normal leading-tight">
          Start free
        </h1>
        <div className="bg-gold mt-3 h-0.5 w-14" aria-hidden />
      </div>
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <div className="flex flex-col gap-4">
        <Input
          label="Business name"
          // autoComplete throughout so a password manager fills what it knows
          // and — critically for "new-password" — offers to generate and save
          // the one credential this person will need again tomorrow.
          autoComplete="organization"
          {...register("orgName")}
          error={errors.orgName?.message}
          required
        />
        <Input
          label="Your name"
          autoComplete="name"
          {...register("name")}
          error={errors.name?.message}
          required
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          {...register("email")}
          error={errors.email?.message}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          helperText="At least 10 characters"
          {...register("password")}
          error={errors.password?.message}
          required
        />
      </div>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Create account
      </Button>
      <p className="font-ui text-text-secondary border-border border-t pt-5 text-center text-[0.875rem]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-data-aiAccent rounded-sm font-semibold underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
