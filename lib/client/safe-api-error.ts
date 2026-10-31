/**
 * Map failed fetch/API errors to user-safe messages.
 * Operator diagnostics stay on the server (logs + request id).
 */

const SECRETISH = /password|secret|api[_-]?key|private[_-]?key|service[_-]?role|authorization|bearer\s+[a-z0-9._-]+/i
const INFRA = /PGRST|postgres|supabase\.co|ECONNREFUSED|getaddrinfo|ECONNRESET|socket hang up|ETL|stack trace/i

export function toClientSafeErrorMessage(raw: unknown, fallback = "Something went wrong. Please try again."): string {
  let text = ""
  if (typeof raw === "string") text = raw
  else if (raw instanceof Error) text = raw.message
  else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>
    text = String(o.message || o.error || o.code || "")
  }
  text = text.replace(/\s+/g, " ").trim().slice(0, 200)
  if (!text) return fallback
  if (SECRETISH.test(text) || INFRA.test(text)) return fallback
  // Prefer stable codes over prose when present
  if (/^[A-Z][A-Z0-9_]{2,64}$/.test(text)) {
    return humanizeErrorCode(text) || fallback
  }
  return text
}

function humanizeErrorCode(code: string): string | null {
  const map: Record<string, string> = {
    AUTH_REQUIRED: "Please sign in again.",
    RATE_LIMITED: "Too many requests. Please wait a moment.",
    INVALID_AMOUNT_ATOMIC: "That amount is not valid.",
    PI_EARNINGS_PAYOUT_REQUESTS_DISABLED: "Withdrawals are not enabled on this deployment yet.",
    EARNINGS_LEDGER_UNAVAILABLE: "Earnings ledger is temporarily unavailable.",
    IDEMPOTENCY_KEY_REQUIRED: "Please retry the request.",
    REQUEST_TOO_LARGE: "Request is too large.",
  }
  return map[code] || null
}

export function extractRequestId(res: Response | null | undefined, body?: Record<string, unknown> | null): string | undefined {
  const h = res?.headers?.get("x-request-id") || undefined
  if (h) return h
  const b = body?.requestId
  return typeof b === "string" ? b : undefined
}
