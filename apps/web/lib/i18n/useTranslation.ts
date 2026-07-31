"use client";

import { useUiStore } from "@/stores/ui-store";
import { dictionary, type TranslationKey } from "./dictionary";

export function useTranslation() {
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);

  function t(key: TranslationKey): string {
    return dictionary[language][key] ?? dictionary.en[key] ?? key;
  }

  return { t, language, setLanguage };
}
