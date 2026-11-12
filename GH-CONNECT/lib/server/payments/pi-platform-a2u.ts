/** Server-only, bounded Pi Platform API calls for the A2U recovery lane.
 * The official pi-backend 0.1.3 SDK deliberately collapses every
 * getIncompleteServerPayments transport/API failure to `unknown_error`.
 * This adapter preserves only safe status/provider error codes so operators
 * can distinguish auth, network, and provider failures without logging bodies.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { getPiApiKey } from "@/lib/server/payments/pi-api"
export type PiA2uPayment = {
  identifier?: string
  direction?: string
  network?: string
  user_uid?: string
  to_address?: string
  amount?: number | string
  metadata?: Record<string, unknown> | null
  status?: { developer_completed?: boolean; transaction_verified?: boolean; cancelled?: boolean; user_cancelled?: boolean }
  transaction?: { txid?: string; verified?: boolean } | null
}

export class PiPlatformA2uError extends Error {
  readonly code: string
  readonly httpStatus?: number
  readonly providerCode?: string

  constructor(code: string, options?: { httpStatus?: number; providerCode?: string }) {
    super(code)
    this.name = "PiPlatformA2uError"
    this.code = code
    this.httpStatus = options?.httpStatus
    this.providerCode = options?.providerCode
  }
}

function platformBase(): string {
  const configured = readGhcServerEnv().piPlatformApiUrl || "https://api.minepi.com"
  return configured.replace(/\/+$/, "").replace(/\/v2$/i, "")
}

function safeProviderCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  return normalized && normalized.length <= 64 ? normalized : undefined
}

async function requestPi<T>(path: string): Promise<T> {
  const apiKey = getPiApiKey()
  if (!apiKey) throw new PiPlatformA2uError("PI_API_KEY_MISSING")
  let response: Response
  try {
    response = await fetch(`${platformBase()}/v2${path}`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    throw new PiPlatformA2uError(timedOut ? "PI_INCOMPLETE_LOOKUP_TIMEOUT" : "PI_INCOMPLETE_LOOKUP_NETWORK_ERROR")
  }

  const raw = await response.text().catch(() => "")
  if (raw.length > 128 * 1024) throw new PiPlatformA2uError("PI_INCOMPLETE_LOOKUP_RESPONSE_TOO_LARGE", { httpStatus: response.status })
  let body: Record<string, unknown> = {}
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
  } catch {
    if (response.ok) throw new PiPlatformA2uError("PI_INCOMPLETE_LOOKUP_INVALID_JSON", { httpStatus: response.status })
  }

  if (!response.ok) {
    const providerCode = safeProviderCode(body.error || body.code)
    throw new PiPlatformA2uError(
      `PI_INCOMPLETE_LOOKUP_HTTP_${response.status}${providerCode ? `_${providerCode}` : ""}`,
      { httpStatus: response.status, providerCode },
    )
  }
  return body as T
}

export async function getPiIncompleteA2uPayments(): Promise<PiA2uPayment[]> {
  const body = await requestPi<{ incomplete_server_payments?: unknown }>("/payments/incomplete_server_payments")
  if (!Array.isArray(body.incomplete_server_payments)) {
    throw new PiPlatformA2uError("PI_INCOMPLETE_LOOKUP_RESPONSE_INVALID")
  }
  return body.incomplete_server_payments as PiA2uPayment[]
}

/** Convert a Pi SDK error into a stable, safe diagnostic without its raw message. */
export function piA2uErrorDiagnostic(error: unknown, stage: string): string {
  if (error instanceof PiPlatformA2uError) return error.code
  const candidate = error && typeof error === "object" && "code" in error
    ? safeProviderCode((error as { code?: unknown }).code)
    : undefined
  const stageCode = stage.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 40)
  if (candidate) return `PI_${stageCode}_${candidate}`.slice(0, 120)
  const safeMessage = error instanceof Error ? error.message.trim() : ""
  if (/^[A-Z0-9_]{3,120}$/.test(safeMessage)) return safeMessage
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return `PI_${stageCode}_TIMEOUT`.slice(0, 120)
  }
  return `PI_${stageCode}_FAILED`.slice(0, 120)
}

export function piA2uErrorHttpStatus(error: unknown): number | undefined {
  if (error instanceof PiPlatformA2uError) return error.httpStatus
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { status?: unknown } }).response
    return typeof response?.status === "number" && Number.isInteger(response.status) ? response.status : undefined
  }
  return undefined
}
