"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Language } from "@/stores/ui-store";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const LANGUAGE_OPTIONS: { value: Language; labelKey: TranslationKey }[] = [
  { value: "en", labelKey: "pos.language.english" },
  { value: "ig", labelKey: "pos.language.igbo" },
  { value: "yo", labelKey: "pos.language.yoruba" },
  { value: "ha", labelKey: "pos.language.hausa" },
];

export function LanguageToggle() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <div className="bg-surface-secondary flex flex-wrap justify-center gap-1 rounded-full p-1">
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLanguage(option.value)}
          aria-pressed={language === option.value}
          className={cn(
            "font-ui flex min-h-[44px] items-center rounded-full px-3 text-[0.8125rem] font-bold",
            language === option.value ? "bg-gold text-midnight" : "text-text-secondary",
          )}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
}
