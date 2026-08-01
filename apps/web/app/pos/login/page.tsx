"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { phoneLoginSchema, type PhoneLoginFormValues } from "@/lib/validation/pos.schema";
import { api, ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { getOrCreateDeviceId } from "@/lib/pos/device-id";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Alert } from "@/components/ui/Alert";
import { LanguageToggle } from "@/components/pos/LanguageToggle";

export default function PosLoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<PhoneLoginFormValues>({ resolver: zodResolver(phoneLoginSchema) });

  async function onSubmit(values: PhoneLoginFormValues) {
    setFormError(null);
    try {
      const result = await api.post<{ accessToken: string }>("/v1/auth/staff/login", {
        ...values,
        deviceId: getOrCreateDeviceId(),
      });
      useAuthStore.getState().setAccessToken(result.accessToken);
      router.push("/pos/sell");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("pos.login.error"));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-6">
      <div className="flex justify-center">
        <LanguageToggle />
      </div>
      <h1 className="font-ui text-center text-[2rem] font-bold text-white">
        {t("pos.login.title")}
      </h1>
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <label htmlFor="pos-login-phone" className="sr-only">
          {t("pos.login.phone")}
        </label>
        <input
          id="pos-login-phone"
          {...register("phone")}
          type="tel"
          inputMode="tel"
          autoFocus
          placeholder={t("pos.login.phone")}
          className="font-data text-midnight h-16 rounded-2xl border-0 bg-white px-6 text-center text-[1.5rem] font-bold"
        />
        <label htmlFor="pos-login-pin" className="sr-only">
          {t("pos.login.pin")}
        </label>
        <input
          id="pos-login-pin"
          {...register("pin")}
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder={t("pos.login.pin")}
          className="font-data text-midnight h-16 rounded-2xl border-0 bg-white px-6 text-center text-[1.5rem] font-bold tracking-[0.5em]"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="font-ui bg-gold text-midnight min-h-[72px] rounded-2xl text-[1.5rem] font-bold transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {t("pos.login.submit")}
        </button>
      </form>
    </div>
  );
}
