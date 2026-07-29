import type { ApiResponse } from "@vela/types";
import { useAuthStore } from "@/stores/auth-store";

// Foundation's typed API client. Once Phase 2 introduces the OpenAPI spec
// (Handbook 4.7/7.8), this is replaced by the generated client — no raw fetch
// calls scattered through components even before that pipeline exists.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// requireAuth (Handbook 8.1) only accepts a Bearer access token — these are
// the endpoints that either don't need one or are how one gets minted, so
// they never go through the "attach token" / "refresh on 401" logic below
// (attaching a stale token to /refresh, or refreshing in response to /login's
// own 401, would be nonsensical).
const NO_AUTH_PATHS = ["/v1/auth/login", "/v1/auth/signup", "/v1/auth/refresh", "/v1/auth/logout"];

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

async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
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
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && !isRetry && !skipAuth) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      useAuthStore.getState().setAccessToken(refreshedToken);
      return request<T>(path, init, true);
    }
    useAuthStore.getState().setAccessToken(null);
  }

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new ApiError(body.error.code, body.error.message, res.status);
  }
  return body.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
