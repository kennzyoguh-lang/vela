"use client";

import { useEffect } from "react";
import { OctagonAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

// POS's audience is semi-literate traders/staff (see pos/layout.tsx) — a
// crash here must never leave someone stuck on an unstyled Next.js error
// screen with no obvious way out. Uses its own translated copy (not the
// shared ErrorState, which is English-only) since this is the one segment
// of the app with real en/ig/yo/ha support — the logo header from
// pos/layout.tsx stays visible; only the content area is replaced.
export default function PosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <OctagonAlert className="text-rust size-10" aria-hidden />
      <div>
        <p className="font-ui text-[1.125rem] font-bold text-white">{t("pos.error.title")}</p>
        <p className="font-ui mt-1 text-[0.875rem] text-white/70">{t("pos.error.message")}</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="font-ui bg-gold text-midnight min-h-[44px] rounded-full px-6 font-bold"
      >
        {t("pos.error.retry")}
      </button>
    </div>
  );
}
