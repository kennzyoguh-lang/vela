import type { ApiResponse } from "@vela/types";
import { useAuthStore } from "@/stores/auth-store";

// Foundation's typed API client. Once Phase 2 introduces the OpenAPI spec
// (Handbook 4.7/7.8), this is replaced by the generated client — no raw fetch
// calls scattered through components even before that pipeline exists.
//
// Empty string in production, not an absolute URL: when the API is deployed
// on a different domain than this app (e.g. Render vs Vercel), requests must
// go through next.config.js's same-origin rewrite (API_PROXY_TARGET) rather
// than hitting the API directly cross-origin — session cookies (httpOnly,
// SameSite=Strict, no Domain attribute) are only visible to middleware.ts
// when the browser sees them as set by THIS app's own origin. `${""}${path}`
// resolves to a same-origin relative path, which the rewrite then intercepts.
// Vercel's env UI won't accept an explicitly empty value for NEXT_PUBLIC_API_URL,
// so this branches on NODE_ENV (which Next.js always inlines client-side)
// instead of requiring one to be set.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");

// requireAuth (Handbook 8.1) only accepts a Bearer access token — these are
// the endpoints that either don't need one or are how one gets minted, so
// they never go through the "attach token" / "refresh on 401" logic below
// (attaching a stale token to /refresh, or refreshing in response to /login's
// own 401, would be nonsensical).
// /v1/auth/2fa/verify has no session yet either — and critically, a wrong
// code there must not trigger the 401-retry-and-refresh logic below (meant
// for an expired session), which would otherwise silently double the
// attempts consumed against the per-account lockout and add confusing
// latency to a simple "wrong code" error.
const NO_AUTH_PATHS = [
  "/v1/auth/login",
  "/v1/auth/signup",
  "/v1/auth/refresh",
  "/v1/auth/logout",
  "/v1/auth/2fa/verify",
  // Phone+PIN staff login (anti-theft/POS feature) — same reasoning as
  // 2fa/verify above: no session exists yet, and a wrong PIN's 401 must not
  // trigger the refresh-and-retry logic meant for an expired session.
  "/v1/auth/staff/login",
];

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

let refreshPromise: Promise<string | null> | null = null;

// Access tokens live in memory only (auth-store), so a page reload always
// starts with none. Concurrent callers share one in-flight refresh instead of
// each firing their own /v1/auth/refresh request.
function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as ApiResponse<{ accessToken: string | null }>;
        return body.success ? body.data.accessToken : null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Attaches the Bearer token and retries once through a silent refresh on a
// 401 — the one place this logic lives, shared by the JSON request() helper
// below, openAuthenticatedPdf() (a plain <a href> to a PDF endpoint can't
// carry an Authorization header, so any authenticated file download must go
// through this instead of a raw anchor tag), and streamAskVela() (a streamed
// response body can't go through request()'s single res.json() either).
export async function authorizedFetch(
  path: string,
  init: RequestInit = {},
  isRetry = false,
): Promise<Response> {
  const skipAuth = NO_AUTH_PATHS.includes(path);
  let token = useAuthStore.getState().accessToken;
  if (!token && !skipAuth) {
    token = await refreshAccessToken();
    if (token) useAuthStore.getState().setAccessToken(token);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && !isRetry && !skipAuth) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      useAuthStore.getState().setAccessToken(refreshedToken);
      return authorizedFetch(path, init, true);
    }
    useAuthStore.getState().setAccessToken(null);
  }

  return res;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authorizedFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new ApiError(body.error.code, body.error.message, res.status);
  }
  return body.data;
}

// Fetches an authenticated PDF (or other file) endpoint and opens it in a new
// tab. Every PDF download in the app must go through this, not a plain
// `<a href={apiUrl}>` — requireAuth only accepts a Bearer header, which a
// browser-navigated anchor click never sends.
//
// The tab is opened synchronously, before the `await`, and only pointed at
// the blob URL once the fetch resolves — opening it *after* an await loses
// the "direct response to a user gesture" context most browsers require to
// avoid popup-blocking, even though the fetch itself was triggered by a click.
export async function openAuthenticatedPdf(path: string): Promise<void> {
  const pendingTab = window.open("", "_blank");
  try {
    const res = await authorizedFetch(path, { method: "GET" });
    if (!res.ok) {
      let message = "Couldn't load the document.";
      try {
        const body = (await res.json()) as ApiResponse<unknown>;
        if (!body.success) message = body.error.message;
      } catch {
        // Response wasn't JSON (e.g. the PDF itself) — keep the generic message.
      }
      throw new ApiError("PDF_FETCH_FAILED", message, res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (pendingTab) {
      pendingTab.location.href = url;
    } else {
      // The synchronous open() itself got blocked (rare) — fall back to a
      // second attempt, which at least has a chance outside stricter policies.
      window.open(url, "_blank");
    }
    // Revoked after a delay rather than immediately — revoking right away can
    // race the new tab's own load of the blob URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    pendingTab?.close();
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
