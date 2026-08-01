interface AccessTokenClaims {
  orgId: string;
  role: string;
}

// Client-side only, unverified decode — purely for UI routing decisions
// (e.g. redirecting an owner/admin away from staff-only POS screens). The
// server independently re-validates the real JWT signature and enforces
// RBAC on every request regardless (Handbook 8.1) — this must never be
// treated as a security boundary on its own.
export function decodeAccessTokenClaims(token: string): AccessTokenClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}
