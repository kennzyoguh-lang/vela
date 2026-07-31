"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function LanguageToggle() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <div className="bg-surface-secondary flex rounded-full p-1">
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={cn(
          "font-ui rounded-full px-4 py-2 text-[0.875rem] font-bold",
          language === "en" ? "bg-gold text-midnight" : "text-text-secondary",
        )}
      >
        {t("pos.language.english")}
      </button>
      <button
        type="button"
        onClick={() => setLanguage("ig")}
        aria-pressed={language === "ig"}
        className={cn(
          "font-ui rounded-full px-4 py-2 text-[0.875rem] font-bold",
          language === "ig" ? "bg-gold text-midnight" : "text-text-secondary",
        )}
      >
        {t("pos.language.igbo")}
      </button>
    </div>
  );
}
