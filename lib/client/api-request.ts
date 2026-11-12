/**
 * Phase 2 — Client API request convention.
 * Auth headers from IdentityService, bounded timeout, safe error extraction.
 * Does not invent success; callers must interpret `ok` and server payloads.
 */

import { IdentityService } from "@/lib/identity/identity-service"
import { toClientSafeErrorMessage, humanizeClientErrorCode } from "@/lib/client/safe-api-error"

export type ApiRequestOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  /** Default 20s */
  timeoutMs?: number
  signal?: AbortSignal
  /** When false, omit Authorization (public routes) */
  auth?: boolean
  cache?: RequestCache
}

export type ApiRequestResult<T = unknown> = {
  ok: boolean
  status: number
  data: T | null
  error: string | null
  code: string | null
  requestId: string | null
  timedOut: boolean
}

function mergeSignals(a?: AbortSignal | null, b?: AbortSignal | null): AbortSignal | undefined {
  if (!a && !b) return undefined
  if (a && !b) return a
  if (b && !a) return b
  const ctrl = new AbortController()
  const onAbort = () => {
    try {
      ctrl.abort()
    } catch {
      /* */
    }
  }
  if (a?.aborted || b?.aborted) {
    onAbort()
    return ctrl.signal
  }
  a?.addEventListener("abort", onAbort, { once: true })
  b?.addEventListener("abort", onAbort, { once: true })
  return ctrl.signal
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiRequestResult<T>> {
  const timeoutMs = Math.max(1_000, Math.min(120_000, options.timeoutMs ?? 20_000))
  const method = (options.method || (options.body !== undefined ? "POST" : "GET")).toUpperCase()
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.auth === false ? {} : IdentityService.getAuthHeaders()),
    ...(options.headers || {}),
  }
  let body: string | undefined
  if (options.body !== undefined) {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json"
    }
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body)
  }

  const timeoutCtrl = new AbortController()
  const timer = setTimeout(() => {
    try {
      timeoutCtrl.abort()
    } catch {
      /* */
    }
  }, timeoutMs)
  const signal = mergeSignals(options.signal, timeoutCtrl.signal)

  try {
    const res = await fetch(path, {
      method,
      headers,
      body,
      credentials: "include",
      cache: options.cache ?? "no-store",
      signal,
    })
    clearTimeout(timer)
    let data: T | null = null
    const text = await res.text().catch(() => "")
    if (text) {
      try {
        data = JSON.parse(text) as T
      } catch {
        data = null
      }
    }
    const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null
    const code =
      record && typeof record.code === "string"
        ? record.code
        : record && typeof record.error === "string" && /^[A-Z][A-Z0-9_]+$/.test(record.error)
          ? record.error
          : null
    const rawErr =
      record && (record.error || record.message)
        ? String(record.error || record.message)
        : res.ok
          ? null
          : `HTTP ${res.status}`
    const error = rawErr
      ? code
        ? humanizeClientErrorCode(code, toClientSafeErrorMessage(rawErr))
        : toClientSafeErrorMessage(rawErr)
      : null
    const requestId =
      res.headers.get("x-request-id") ||
      (record && typeof record.requestId === "string" ? record.requestId : null)
    return {
      ok: res.ok && !(record && record.ok === false),
      status: res.status,
      data,
      error,
      code,
      requestId,
      timedOut: false,
    }
  } catch (e) {
    clearTimeout(timer)
    const timedOut =
      (e instanceof Error && e.name === "AbortError") ||
      (typeof e === "object" && e !== null && (e as { name?: string }).name === "AbortError")
    return {
      ok: false,
      status: 0,
      data: null,
      error: timedOut
        ? "Request timed out. Check your connection and try again."
        : toClientSafeErrorMessage(e),
      code: timedOut ? "NETWORK_TIMEOUT" : "NETWORK_ERROR",
      requestId: null,
      timedOut,
    }
  }
}
