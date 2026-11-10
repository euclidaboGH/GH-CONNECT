/**
 * Phase 1 architecture — shared API response conventions.
 * Financial and privileged routes must use no-store and sanitized errors.
 */
import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"

export const FINANCIAL_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const

/** Correlation id for logs and response headers (never a secret). */
export function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`
}

export function withRequestId(headers: Headers | Record<string, string> | undefined, requestId: string): Record<string, string> {
  const out: Record<string, string> = { ...(headers as Record<string, string> | undefined) }
  out["x-request-id"] = requestId
  return out
}

/**
 * Client-safe error body. Never attach raw provider/DB stack traces.
 * `operatorCode` is optional internal taxonomy for support — not secrets.
 */
export function financialJson(
  body: Record<string, unknown>,
  status = 200,
  init?: { requestId?: string; noStore?: boolean },
) {
  const headers: Record<string, string> = {
    ...(init?.noStore !== false ? FINANCIAL_NO_STORE : {}),
  }
  if (init?.requestId) headers["x-request-id"] = init.requestId
  return NextResponse.json(body, { status, headers })
}

export function financialError(
  code: string,
  message: string,
  status = 400,
  init?: { requestId?: string; retryable?: boolean; operatorCode?: string },
) {
  const body: Record<string, unknown> = {
    ok: false,
    error: code,
    code,
    message,
  }
  if (init?.retryable === true) body.retryable = true
  if (init?.operatorCode) body.operatorCode = init.operatorCode
  return financialJson(body, status, { requestId: init?.requestId, noStore: true })
}

/** Strip accidental provider leakage from messages shown to clients. */
export function sanitizeClientMessage(raw: unknown, fallback = "Request failed"): string {
  const s = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : fallback
  const trimmed = s.replace(/\s+/g, " ").trim().slice(0, 200)
  if (/password|secret|api[_-]?key|private[_-]?key|service[_-]?role|authorization/i.test(trimmed)) {
    return fallback
  }
  if (/PGRST|postgres|supabase\.co|ECONNREFUSED|getaddrinfo/i.test(trimmed)) {
    return "Service temporarily unavailable"
  }
  return trimmed || fallback
}
