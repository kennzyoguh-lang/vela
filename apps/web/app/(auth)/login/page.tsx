"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { loginSchema, type LoginFormValues } from "@/lib/validation/auth.schema";
import { api, ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
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
      const result = await api.post<
        | { requiresTwoFa: true; challengeToken: string }
        | { requiresTwoFa: false; accessToken: string }
      >("/v1/auth/login", values);
      if (result.requiresTwoFa) {
        // No real access token exists yet — nothing to store there. The
        // challenge token is single-purpose (redeemable only at
        // /v1/auth/2fa/verify) and lives in the same in-memory store.
        useAuthStore.getState().setChallengeToken(result.challengeToken);
        router.push("/2fa");
      } else {
        useAuthStore.getState().setAccessToken(result.accessToken);
        router.push("/dashboard");
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
    // gap-5 between groups, not gap-4 between everything: a flat rhythm gave
    // the heading, the two fields, the submit and the footer identical weight,
    // so the card read as a list of six equal things rather than a form with a
    // top, a middle and a bottom.
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      {/* The ledger-statement header PageHeader established for every page
          inside the app — gold mono eyebrow, serif display title, gold rule —
          scaled down for a 400px card. The generic centred 1.25rem UI heading
          this replaces was the one screen in the product that didn't look like
          the product, on the one screen every new user sees first. */}
      <div>
        <p className="font-data text-gold mb-2 text-[0.7rem] font-bold uppercase tracking-[0.14em]">
          Welcome back
        </p>
        <h1 className="font-display text-text-primary text-[1.75rem] font-normal leading-tight">
          Log in
        </h1>
        <div className="bg-gold mt-3 h-0.5 w-14" aria-hidden />
      </div>
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <div className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoFocus
          // Without these a password manager can't recognise the pair, so it
          // neither fills nor offers to save — the single highest-friction
          // thing about a login form on a phone.
          autoComplete="email"
          inputMode="email"
          {...register("email")}
          error={errors.email?.message}
          required
        />
        {/* The recovery link belongs to the password field, so it sits tight
            under it inside the same group instead of floating in the form's
            own rhythm. */}
        <div className="flex flex-col gap-1">
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
            error={errors.password?.message}
            required
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              // inline-flex + min-h-[44px]: a 12px link was a ~16px-tall tap
              // target, well under the floor, and it's the control someone
              // reaches for at their most frustrated.
              className="font-ui text-data-aiAccent duration-quick -mr-2 inline-flex min-h-[44px] items-center rounded-sm px-2 text-[0.8125rem] underline-offset-4 transition-colors hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
      {/* size="lg": 48px for the screen's one primary action, comfortably over
          the tap-target floor and confident enough to anchor the card. */}
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Log in
      </Button>
      {/* Ruled off: the signup route out of this card is a different subject
          from the form above it, and the hairline says so more quietly than
          another gap would. */}
      <p className="font-ui text-text-secondary border-border border-t pt-5 text-center text-[0.875rem]">
        New to VELA?{" "}
        <Link
          href="/signup"
          className="text-data-aiAccent rounded-sm font-semibold underline-offset-4 hover:underline"
        >
          Start free
        </Link>
      </p>
    </form>
  );
}
