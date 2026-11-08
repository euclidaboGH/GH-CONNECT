import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitStatus, durableRateLimitCode } from "@/lib/server/security/control-plane"
import { issuePinProof, pinProofConfigured } from "@/lib/server/identity/withdrawal-pin-proof"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import {
  getWithdrawalPinStatus,
  setWithdrawalPin,
  changeWithdrawalPin,
  verifyWithdrawalPin,
  isValidPinFormat,
  isWeakPin,
} from "@/lib/server/identity/withdrawal-pin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers })
}

/** GET — whether a PIN is configured / locked (never returns hash). */
export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const status = await getWithdrawalPinStatus(auth.userId)
  return reply({
    ok: status.ok,
    configured: status.configured,
    locked: status.locked,
    lockedUntil: status.lockedUntil || null,
    ...(status.error ? { error: status.error } : {}),
  })
}

/**
 * POST actions:
 * - { action: "set", pin, confirmPin }
 * - { action: "verify", pin }
 * - { action: "change", currentPin, newPin, confirmPin }  (requires the current PIN; forgotten PINs use pin-recovery)
 */
export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  // Durable (shared across serverless instances); deny if the limiter is unavailable.
  const limit = await checkDurableRateLimit(`withdrawal-pin:${auth.userId}`, 20, 60_000, { onUnavailable: "deny" })
  if (!limit.ok) return reply({ ok: false, error: durableRateLimitCode(limit), retryAfterSec: limit.retryAfterSec }, durableRateLimitStatus(limit))

  const parsed = await readBoundedJson(request, 2 * 1024)
  if (!parsed.ok) {
    return reply({ ok: false, error: parsed.error }, parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  }
  const body = parsed.value as { action?: unknown; pin?: unknown; confirmPin?: unknown; bindKey?: unknown; currentPin?: unknown; newPin?: unknown }
  const action = typeof body.action === "string" ? body.action : ""

  if (action === "set") {
    if (!isValidPinFormat(body.pin) || !isValidPinFormat(body.confirmPin)) {
      return reply({ ok: false, error: "PIN_FORMAT_INVALID", message: "Use a 6-digit numeric PIN." }, 400)
    }
    if (isWeakPin(body.pin)) {
      return reply({ ok: false, error: "PIN_TOO_WEAK", message: "Choose a less guessable PIN (no repeated digits or simple sequences)." }, 400)
    }
    if (body.pin !== body.confirmPin) {
      return reply({ ok: false, error: "PIN_MISMATCH" }, 400)
    }
    const result = await setWithdrawalPin({ userId: auth.userId, pin: body.pin })
    if (!result.ok) return reply({ ok: false, error: result.error }, result.error === "PIN_ALREADY_CONFIGURED" ? 409 : 503)
    return reply({ ok: true, configured: true, message: "Withdrawal PIN saved. It is never sent to Pi." })
  }

  if (action === "change") {
    if (!isValidPinFormat(body.currentPin) || !isValidPinFormat(body.newPin) || !isValidPinFormat(body.confirmPin)) {
      return reply({ ok: false, error: "PIN_FORMAT_INVALID", message: "Use 6-digit numeric PINs." }, 400)
    }
    if (body.newPin !== body.confirmPin) return reply({ ok: false, error: "PIN_MISMATCH" }, 400)
    const result = await changeWithdrawalPin({ userId: auth.userId, currentPin: body.currentPin, newPin: body.newPin })
    if (!result.ok) {
      const status =
        result.error === "PIN_LOCKED" || result.error === "PIN_COOLDOWN" ? 423
        : result.error === "PIN_NOT_CONFIGURED" ? 409
        : result.error === "PIN_INVALID" ? 401
        : result.error === "PIN_TOO_WEAK" || result.error === "PIN_UNCHANGED" || result.error === "PIN_FORMAT_INVALID" ? 400
        : 503
      return reply({ ok: false, error: result.error }, status)
    }
    return reply({ ok: true, changed: true, message: "Withdrawal PIN changed. It is never sent to Pi." })
  }

  if (action === "verify") {
    if (!isValidPinFormat(body.pin)) {
      return reply({ ok: false, error: "PIN_FORMAT_INVALID" }, 400)
    }
    const result = await verifyWithdrawalPin({ userId: auth.userId, pin: body.pin })
    if (!result.ok) {
      const status = result.error === "PIN_LOCKED" || result.error === "PIN_COOLDOWN" ? 423 : result.error === "PIN_NOT_CONFIGURED" ? 409 : 401
      return reply({ ok: false, error: result.error }, status)
    }
    // Proof is bound to this user + idempotency key and required by the withdrawals route.
    const bindKey = typeof body.bindKey === "string" ? body.bindKey.trim() : ""
    if (bindKey) {
      if (!pinProofConfigured()) return reply({ ok: false, error: "PIN_PROOF_SECRET_MISSING" }, 503)
      return reply({ ok: true, verified: true, pinProof: issuePinProof(auth.userId, bindKey) })
    }
    return reply({ ok: true, verified: true })
  }

  return reply({ ok: false, error: "ACTION_REQUIRED" }, 400)
}
