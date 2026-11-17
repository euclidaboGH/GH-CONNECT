/**
 * Shared operator/service key verification for privileged (non-user) routes.
 *
 * Phase 2 (auth & secrets):
 * - Per-purpose keys only. Callers must pass exactly one env name. Fallback
 *   chains (A || B || C) are no longer supported by this helper.
 * - Minimum key length is 32 bytes for every purpose (including former shared
 *   worker keys). Rotate any remaining 16-byte keys before deploying.
 * - Comparison hashes both sides first so the comparison is constant-time and
 *   does not reveal the expected key length through an early length-mismatch.
 * - GHC_PUBLIC_DIAGNOSTICS is removed. Diagnostic detail requires a purpose key.
 *
 * Generate keys with: openssl rand -base64 48
 */
import { createHash, timingSafeEqual } from "node:crypto"

/** Dedicated operator keys. Generate with: openssl rand -base64 48 */
export const OPERATOR_KEY_MIN_BYTES = 32

/**
 * @deprecated Use OPERATOR_KEY_MIN_BYTES. All purposes now require 32 bytes.
 * Kept as an alias so existing call sites that import the name continue to compile
 * while they are migrated to the single constant.
 */
export const SHARED_WORKER_KEY_MIN_BYTES = OPERATOR_KEY_MIN_BYTES

export type OperatorKeyOptions = {
  /** Request headers to read the supplied key from (first present non-empty header wins). */
  headers: string[]
  /**
   * Exactly one environment variable name holding the expected key for this purpose.
   * Passing multiple names is rejected at call time (fail closed).
   */
  envNames: [string]
  /** Minimum accepted key length in bytes. Defaults to OPERATOR_KEY_MIN_BYTES. */
  minBytes?: number
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest()
}

/**
 * Authorize a privileged request against a single purpose-specific operator key.
 * Returns false when the env is missing, too short, or the supplied header does not match.
 */
export function operatorKeyAuthorized(request: Request, options: OperatorKeyOptions): boolean {
  if (!options.envNames || options.envNames.length !== 1) {
    // Fail closed: multi-env fallback chains are no longer permitted.
    return false
  }
  const minBytes = options.minBytes ?? OPERATOR_KEY_MIN_BYTES
  const envName = options.envNames[0]
  const expected = String(process.env[envName] || "").trim()
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
  // Length check before digest comparison is safe: both digests are fixed-size SHA-256.
  return timingSafeEqual(digest(supplied), digest(expected))
}

/** Header/env contract used by operator diagnostics and reconciliation endpoints. */
export function operatorDiagnosticsAuthorized(request: Request): boolean {
  return operatorKeyAuthorized(request, {
    headers: ["x-ghc-operator-key"],
    envNames: ["GHC_OPERATOR_RECONCILE_KEY"],
    minBytes: OPERATOR_KEY_MIN_BYTES,
  })
}

/**
 * Detailed readiness/diagnostic output.
 * Phase 2: anonymous / public diagnostics are no longer permitted.
 * Callers must present a valid operator reconcile key.
 */
export function diagnosticsDetailAllowed(request: Request): boolean {
  return operatorDiagnosticsAuthorized(request)
}

/** Admin console / revenue / readiness surfaces. Header: x-ghc-admin-key */
export function adminKeyAuthorized(request: Request): boolean {
  return operatorKeyAuthorized(request, {
    headers: ["x-ghc-admin-key", "x-ghc-operator-key"],
    envNames: ["GHC_ADMIN_API_KEY"],
    minBytes: OPERATOR_KEY_MIN_BYTES,
  })
}

/** A2U worker / Pi earnings executor surfaces. Header: x-ghc-a2u-admin-key */
export function a2uAdminKeyAuthorized(request: Request): boolean {
  return operatorKeyAuthorized(request, {
    headers: ["x-ghc-a2u-admin-key", "x-ghc-operator-key"],
    envNames: ["GHC_A2U_ADMIN_KEY"],
    minBytes: OPERATOR_KEY_MIN_BYTES,
  })
}

/** Earnings executor (withdrawal processing). Header: x-pi-earnings-executor-key */
export function earningsExecutorKeyAuthorized(request: Request): boolean {
  return operatorKeyAuthorized(request, {
    headers: ["x-pi-earnings-executor-key", "x-ghc-a2u-admin-key"],
    envNames: ["PI_EARNINGS_EXECUTOR_KEY"],
    minBytes: OPERATOR_KEY_MIN_BYTES,
  })
}

/** Marketplace payout reconciliation / transition. Header: x-ghc-payout-reconcile-key */
export function payoutReconcileKeyAuthorized(request: Request): boolean {
  return operatorKeyAuthorized(request, {
    headers: ["x-ghc-payout-reconcile-key", "x-ghc-operator-key"],
    envNames: ["GHC_PAYOUT_RECONCILIATION_KEY"],
    minBytes: OPERATOR_KEY_MIN_BYTES,
  })
}
