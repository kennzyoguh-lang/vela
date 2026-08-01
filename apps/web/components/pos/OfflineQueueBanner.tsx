"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CloudOff } from "lucide-react";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";
import { flushOfflineQueue } from "@/lib/offline/flushOfflineQueue";
import { useTranslation } from "@/lib/i18n/useTranslation";

// Anti-theft's whole promise depends on every sale/cash-check actually
// reaching the server — a silently-dropped request on a bad connection
// would quietly defeat that promise for exactly the traders most likely to
// have unreliable connectivity. Mounted once in the POS layout so it
// retries on every navigation, on the browser's own "online" event, and
// isn't duplicated per-screen.
//
// Skipped entirely on /pos/login: there's no access token yet there, so a
// flush attempt would 401 and flushOfflineQueue would (wrongly) treat that
// as a genuine ApiError and drop otherwise-good queued items.
export function OfflineQueueBanner() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const queue = useOfflineQueueStore((s) => s.queue);
  const isLoginPage = pathname === "/pos/login";

  useEffect(() => {
    if (isLoginPage) return;
    flushOfflineQueue();
    window.addEventListener("online", flushOfflineQueue);
    return () => window.removeEventListener("online", flushOfflineQueue);
  }, [isLoginPage]);

  if (isLoginPage || queue.length === 0) return null;

  const message =
    queue.length === 1
      ? t("pos.offline.pendingOne")
      : t("pos.offline.pendingMany").replace("{count}", String(queue.length));

  return (
    <div className="bg-cobalt/15 border-cobalt/40 font-ui flex items-center gap-2 rounded-2xl border px-4 py-3 text-[0.875rem] font-semibold text-white">
      <CloudOff className="text-cobalt size-5 shrink-0" aria-hidden />
      {message}
    </div>
  );
}
