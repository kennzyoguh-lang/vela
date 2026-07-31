// Minimal, deliberately dependency-free i18n for the anti-theft/POS staff
// screens — no react-intl/next-intl/i18next, just a flat key->string map
// per language and a lookup hook (useTranslation.ts). Flat keys, not
// nested objects, so a missing translation falls back to English by simple
// lookup rather than deep-merging.
//
// FLAG: the Igbo strings below are a structurally-drafted placeholder
// translation, not reviewed by a fluent/native speaker — they should not be
// treated as production-accurate until that review happens.
export const TRANSLATION_KEYS = [
  "pos.login.title",
  "pos.login.phone",
  "pos.login.pin",
  "pos.login.submit",
  "pos.login.error",
  "pos.sell.title",
  "pos.sell.quantity",
  "pos.sell.addName",
  "pos.sell.listening",
  "pos.sell.confirm",
  "pos.sell.confirming",
  "pos.sell.success",
  "pos.sell.error",
  "pos.sell.empty",
  "pos.language.english",
  "pos.language.igbo",
] as const;

export type TranslationKey = (typeof TRANSLATION_KEYS)[number];

export const dictionary: Record<"en" | "ig", Record<TranslationKey, string>> = {
  en: {
    "pos.login.title": "Staff Login",
    "pos.login.phone": "Phone Number",
    "pos.login.pin": "PIN",
    "pos.login.submit": "Log In",
    "pos.login.error": "Wrong phone number or PIN",
    "pos.sell.title": "Sell",
    "pos.sell.quantity": "How many?",
    "pos.sell.addName": "+ Name",
    "pos.sell.listening": "Listening...",
    "pos.sell.confirm": "CONFIRM SALE",
    "pos.sell.confirming": "Saving...",
    "pos.sell.success": "Sale Saved!",
    "pos.sell.error": "Could not save this sale — try again",
    "pos.sell.empty": "No products yet — ask your manager to add some",
    "pos.language.english": "English",
    "pos.language.igbo": "Igbo",
  },
  ig: {
    "pos.login.title": "Nbanye Ndị Ọrụ",
    "pos.login.phone": "Nọmba Ekwentị",
    "pos.login.pin": "PIN",
    "pos.login.submit": "Banye",
    "pos.login.error": "Nọmba ekwentị ma ọ bụ PIN adịghị mma",
    "pos.sell.title": "Ree",
    "pos.sell.quantity": "Ole ole?",
    "pos.sell.addName": "+ Aha",
    "pos.sell.listening": "Ana m ege ntị...",
    "pos.sell.confirm": "KWADO IRE",
    "pos.sell.confirming": "Na-echekwa...",
    "pos.sell.success": "Echekwala Ire!",
    "pos.sell.error": "Enweghị ike ichekwa ire a — nwaa ọzọ",
    "pos.sell.empty": "Onweghị ngwaahịa ka — gwa onye njikwa ka ọ tinye ụfọdụ",
    "pos.language.english": "Bekee",
    "pos.language.igbo": "Igbo",
  },
};
