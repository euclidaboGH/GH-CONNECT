/**
 * Global fetch-based client for making API requests.
 *
 * - Set auth with `setApiAuthToken(token)`; it injects the Authorization header.
 * - Parses JSON automatically; for 204 responses `data` is `null`.
 * - Returns `{ data, status, statusText, headers }`.
 * - On non-2xx, throws an Error with `status` and `data`.
 *
 * @example
 * import { api } from '@/lib/api';
 *
 * const createThing = async () => {
 *   const { data } = await api.post('/api/your-endpoint', { data: 'your data' });
 *   console.log(data);
 * };
 *
 * await api.get('/api/users');
 * await api.put('/api/user/123', { name: 'Updated' });
 * await api.delete('/api/user/123');
 */

import { toClientSafeErrorMessage } from "@/lib/client/safe-api-error"
type FetchResponse<T> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
};

export interface ApiError<T = unknown> extends Error {
  status: number;
  data: T;
}

let authToken: string | null = null;

const defaultHeaders: Record<string, string> = {
  "Content-Type": "application/json",
};

const TRANSIENT_GET_STATUSES = new Set([408, 425, 429, 502, 503, 504])

function isRetryableGetError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return false
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 0
  return status === 0 || TRANSIENT_GET_STATUSES.has(status)
}

const request = async <T = any>(
  url: string,
  init: RequestInit = {}
): Promise<FetchResponse<T>> => {
  const headers: Record<string, string> = {
    ...defaultHeaders,
    ...(authToken ? { Authorization: authToken } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  // Bound hung requests — caller may override via init.signal
  const signal =
    init.signal ??
    (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(30_000)
      : undefined)

  const method = String(init.method || "GET").toUpperCase()
  const retryableRead = method === "GET" && !init.signal
  const maxAttempts = retryableRead ? 3 : 1
  let response: Response | null = null
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      response = await fetch(url, { ...init, headers, signal });
      if (response.ok || !retryableRead || !TRANSIENT_GET_STATUSES.has(response.status) || attempt === maxAttempts) break
    } catch (error) {
      lastError = error
      if (!retryableRead || attempt === maxAttempts || !isRetryableGetError(error)) throw error
    }

    const backoffMs = 250 * (2 ** (attempt - 1))
    await new Promise<void>((resolve) => setTimeout(resolve, backoffMs))
  }

  if (!response) throw (lastError instanceof Error ? lastError : new Error("Request failed"))

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data =
    response.status === 204
      ? null
      : isJson
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    const error = new Error(
      response.statusText || "Request failed"
    ) as ApiError<T>;
    error.status = response.status;
    error.data = data as T;
    throw error;
  }

  return {
    data: data as T,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };
};

export const api = {
  get: <T = any>(url: string, init?: RequestInit) =>
    request<T>(url, { ...init, method: "GET" }),

  delete: <T = any>(url: string, init?: RequestInit) =>
    request<T>(url, { ...init, method: "DELETE" }),

  post: <T = any>(url: string, body?: any, init?: RequestInit) =>
    request<T>(url, {
      ...init,
      method: "POST",
      body: body === undefined ? init?.body : JSON.stringify(body),
    }),

  put: <T = any>(url: string, body?: any, init?: RequestInit) =>
    request<T>(url, {
      ...init,
      method: "PUT",
      body: body === undefined ? init?.body : JSON.stringify(body),
    }),

  patch: <T = any>(url: string, body?: any, init?: RequestInit) =>
    request<T>(url, {
      ...init,
      method: "PATCH",
      body: body === undefined ? init?.body : JSON.stringify(body),
    }),
};

export const setApiAuthToken = (token: string) => {
  authToken = token;
};
