"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { decodeAccessTokenClaims } from "@/lib/auth/decode-access-token";

// Closes the gap middleware.ts flags explicitly: the Edge middleware only
// sees "a session marker cookie exists", not which role it belongs to, so
// an owner/admin who navigates straight to a staff screen (e.g. /pos/sell)
// isn't caught there. This runs client-side, where the real access token
// (and its role claim) actually lives, once it's available — /pos/login
// itself is exempt since it's a fresh phone+PIN form with no dependency on
// whatever session happens to already exist in this browser.
export function PosRoleGate() {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (pathname === "/pos/login" || !accessToken) return;
    const claims = decodeAccessTokenClaims(accessToken);
    if (claims?.role === "owner" || claims?.role === "admin") {
      router.replace("/");
    }
  }, [accessToken, pathname, router]);

  return null;
}
