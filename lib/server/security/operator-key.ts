/**
 * Shared operator/service key verification for privileged (non-user) routes.
 *
 * - Every privileged route must enforce a minimum key length. A configured key of
 *   one or two characters is trivially guessable and must never authorize anything.
 * - Comparison hashes both sides first so the comparison is constant-time and does
 *   not reveal the expected key length through an early length-mismatch return.
 * - The first non-empty configured environment variable wins (same behaviour as the
 *   previous per-route implementations that used `A || B || C`).
 */
import { createHash, timingSafeEqual } from "node:crypto"

/** Dedicated operator keys. Generate with: openssl rand -base64 48 */
export const OPERATOR_KEY_MIN_BYTES = 32
/**
 * Floor for keys that are shared with the Pi earnings executor / A2U worker.
 * Rotate those keys to >= 32 random bytes, then raise this constant to 32.
 */
export const SHARED_WORKER_KEY_MIN_BYTES = 16

export type OperatorKeyOptions = {
  /** Request headers to read the supplied key from (first present non-empty header wins). */
  headers: string[]
  /** Environment variables holding the expected key (first non-empty wins). */
  envNames: string[]
  /** Minimum accepted key length in bytes. Defaults to OPERATOR_KEY_MIN_BYTES. */
  minBytes?: number
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest()
}

export function operatorKeyAuthorized(request: Request, options: OperatorKeyOptions): boolean {
  const minBytes = options.minBytes ?? OPERATOR_KEY_MIN_BYTES
  let expected = ""
  for (const name of options.envNames) {
    const candidate = String(process.env[name] || "").trim()
    if (candidate) {
      expected = candidate
      break
    }
  }
  if (!expected || Buffer.byteLength(expected, "utf8") < minBytes) return false

  let supplied = ""
  for (const header of options.headers) {
    const candidate = String(request.headers.get(header) || "")
    if (candidate) {
      supplied = candidate
      break
    }
  }
  if (!supplied) return false
  return timingSafeEqual(digest(supplied), digest(expected))
}

/** Header/env contract used by operator diagnostics and reconciliation endpoints. */
export function operatorDiagnosticsAuthorized(request: Request): boolean {
  return operatorKeyAuthorized(request, {
    headers: ["x-ghc-operator-key"],
    envNames: ["GHC_OPERATOR_RECONCILE_KEY", "GHC_ADMIN_API_KEY", "GHC_A2U_ADMIN_KEY"],
    minBytes: OPERATOR_KEY_MIN_BYTES,
  })
}

/**
 * Detailed readiness/diagnostic output names missing configuration and the format state of
 * secrets. Anonymous callers only receive a coarse status unless the operator explicitly sets
 * GHC_PUBLIC_DIAGNOSTICS=1 (e.g. temporarily while debugging a Testnet deployment).
 */
export function diagnosticsDetailAllowed(request: Request): boolean {
  if (process.env.GHC_PUBLIC_DIAGNOSTICS === "1") return true
  return operatorDiagnosticsAuthorized(request)
}
