import type { ApiResponse } from "@vela/types";

// Foundation's typed API client. Once Phase 2 introduces the OpenAPI spec
// (Handbook 4.7/7.8), this is replaced by the generated client — no raw fetch
// calls scattered through components even before that pipeline exists.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
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
