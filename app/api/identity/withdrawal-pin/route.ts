import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import {
  getWithdrawalPinStatus,
  setWithdrawalPin,
  verifyWithdrawalPin,
  isValidPinFormat,
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
 */
export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const limit = checkRateLimit(`withdrawal-pin:${auth.userId}`, 20, 60_000)
  if (!limit.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)

  const parsed = await readBoundedJson(request, 2 * 1024)
  if (!parsed.ok) {
    return reply({ ok: false, error: parsed.error }, parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  }
  const body = parsed.value as { action?: unknown; pin?: unknown; confirmPin?: unknown }
  const action = typeof body.action === "string" ? body.action : ""

  if (action === "set") {
    if (!isValidPinFormat(body.pin) || !isValidPinFormat(body.confirmPin)) {
      return reply({ ok: false, error: "PIN_FORMAT_INVALID", message: "Use a 6-digit numeric PIN." }, 400)
    }
    if (body.pin !== body.confirmPin) {
      return reply({ ok: false, error: "PIN_MISMATCH" }, 400)
    }
    const result = await setWithdrawalPin({ userId: auth.userId, pin: body.pin })
    if (!result.ok) return reply({ ok: false, error: result.error }, 503)
    return reply({ ok: true, configured: true, message: "Withdrawal PIN saved. It is never sent to Pi." })
  }

  if (action === "verify") {
    if (!isValidPinFormat(body.pin)) {
      return reply({ ok: false, error: "PIN_FORMAT_INVALID" }, 400)
    }
    const result = await verifyWithdrawalPin({ userId: auth.userId, pin: body.pin })
    if (!result.ok) {
      const status = result.error === "PIN_LOCKED" ? 423 : result.error === "PIN_NOT_CONFIGURED" ? 409 : 401
      return reply({ ok: false, error: result.error }, status)
    }
    return reply({ ok: true, verified: true })
  }

  return reply({ ok: false, error: "ACTION_REQUIRED" }, 400)
}
